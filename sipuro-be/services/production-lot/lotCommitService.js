const { chunk } = require('../../helpers/arrayUtils');
const { BusinessError } = require('../../helpers/businessError');
const { syncBatchCompletedDates } = require('./lotStatusService');
const { persistAllocationItems } = require('./lotAllocationPersist');
const { allocationKey, lotKey } = require('./lotAllocationRules');

const SYNC_REASON = 'Auto status sync after production lot upload';

/**
 * Menyimpan hasil perhitungan alokasi lot ke database.
 * `calculation` adalah hasil calculateLotFifoAllocation yang SUDAH dihitung ulang server di dalam transaksi ini.
 * Dipanggil di dalam transaksi (BEGIN/COMMIT/ROLLBACK diatur controller).
 *
 * Pengecekan file duplikat (hash / process timestamp) dilakukan controller di bawah lock;
 * kunci unik production_lot_upload_logs menjadi pengaman terakhir (ER_DUP_ENTRY -> 409).
 * Seluruh kondisi tidak wajar melempar BusinessError sehingga transaksi di-rollback.
 */
// Langkah berurutan pada satu alokasi digabung bila Doc Source-nya sama dan berurutan
const mergeLogSteps = (rawSteps) => {
    const merged = [];
    rawSteps.forEach((st) => {
        const last = merged[merged.length - 1];
        if (last && last.docSource === st.docSource) {
            last.delta += st.delta;
            last.status = st.status;
            if (st.transType && !String(last.transType || '').split(', ').includes(st.transType)) {
                last.transType = last.transType ? `${last.transType}, ${st.transType}` : st.transType;
            }
        } else {
            merged.push({ ...st });
        }
    });
    return merged;
};

const commitProductionAllocationTransaction = async (connection, {
    fileName,
    processTimestamp,
    fileHash,
    userId,
    calculation
}) => {
    const { newRows, previewResults, detailedAllocations } = calculation;
    const uploadReason = `Production lot upload: ${fileName || 'unnamed file'}`;
    const problems = [];

    // 1. Simpan log upload
    const [uploadLogResult] = await connection.query(
        'INSERT INTO production_lot_upload_logs (file_name, process_timestamp, file_hash, uploaded_by) VALUES (?, ?, ?, ?)',
        [fileName, processTimestamp, fileHash || null, userId]
    );
    const uploadLogId = uploadLogResult.insertId;

    // 2. Simpan detail baris Excel
    for (const part of chunk(newRows, 500)) {
        const detailValues = part.map((detail) => [
            uploadLogId,
            // Tambahan output non-produksi tersimpan pada batch terpilih; selainnya batch dari file (kosong untuk jenis lot)
            detail.resolvedBatchNumber || detail.batchNumber,
            detail.lotNumber || '',
            detail.itemCode,
            detail.lotStatus || null,
            detail.transType || null,
            detail.qtyPac || 0,
            detail.actualCompletedDatetime || null,
            detail.expiredDate || null,
            detail.rowHash,
            detail.docSource || null
        ]);
        await connection.query(
            `INSERT INTO production_lot_upload_details
            (upload_log_id, batch_number, lot_number, item_code, lot_status, trans_type, qty_pac, actual_completed_datetime, expired_date, row_hash, doc_source)
            VALUES ?`,
            [detailValues]
        );
    }

    // 3. Upsert master lot (unik per nomor lot + produk).
    //    Tanggal selesai lot = yang terbaru; expired_date yang sudah terisi tidak ditimpa.
    //    Grup berbasis lot (issue) tidak membuat atau mengubah lot: tanggal issue bukan tanggal selesai lot.
    const lotRows = new Map();
    previewResults.forEach((group) => {
        if (!group.lotNumber || !group.idProduct || group.lotOnly) return;

        const key = lotKey(group.lotNumber, group.idProduct);
        const current = lotRows.get(key);
        if (!current) {
            lotRows.set(key, [
                group.lotNumber,
                group.idProduct,
                group.actualCompletedDatetime || null,
                group.expiredDate || null
            ]);
            return;
        }

        // Lot yang sama muncul di beberapa grup (batch berbeda) dalam satu file
        if (group.actualCompletedDatetime && (!current[2] || group.actualCompletedDatetime > current[2])) {
            current[2] = group.actualCompletedDatetime;
        }
        if (!current[3] && group.expiredDate) current[3] = group.expiredDate;
    });

    const lotIdByKey = new Map();
    const lotNumbersInFile = [...new Set(previewResults.filter((g) => g.lotNumber && g.idProduct).map((g) => g.lotNumber))];
    if (lotRows.size > 0) {
        await connection.query(
            `INSERT INTO lots (lot_number, id_product, actual_completed_datetime, expired_date)
             VALUES ?
             ON DUPLICATE KEY UPDATE
                actual_completed_datetime = GREATEST(
                    COALESCE(actual_completed_datetime, VALUES(actual_completed_datetime)),
                    COALESCE(VALUES(actual_completed_datetime), actual_completed_datetime)
                ),
                expired_date = COALESCE(expired_date, VALUES(expired_date))`,
            [[...lotRows.values()]]
        );
    }
    // Id lot dibaca untuk semua lot di file, termasuk lot yang hanya disentuh grup berbasis lot
    for (const part of chunk(lotNumbersInFile, 500)) {
        const [rows] = await connection.query(
            'SELECT id, lot_number, id_product FROM lots WHERE lot_number IN (?)',
            [part]
        );
        rows.forEach((l) => lotIdByKey.set(lotKey(l.lot_number, l.id_product), l.id));
    }

    // 4. Find-or-Create Master Batches (Deduplikasi unik per batch_number)
    const batchNumbers = [...new Set(previewResults.map((g) => g.batchNumber).filter(Boolean))];
    const existingBatches = batchNumbers.length > 0 ? (await connection.query(
        'SELECT id, batch_number, id_product FROM batches WHERE batch_number IN (?)',
        [batchNumbers]
    ))[0] : [];

    const batchIdByNumber = new Map(existingBatches.map((b) => [b.batch_number, b.id]));
    const existingBatchProduct = new Map(existingBatches.map((b) => [b.batch_number, b.id_product]));

    const newBatchesToInsert = [];
    const processedBatchNumbers = new Set();

    previewResults.forEach((group) => {
        if (!group.batchNumber || group.lotOnly) return;

        if (existingBatchProduct.has(group.batchNumber)) {
            if (Number(existingBatchProduct.get(group.batchNumber)) !== Number(group.idProduct)) {
                problems.push(`Batch ${group.batchNumber} already belongs to another product.`);
            }
            return;
        }

        if (!batchIdByNumber.has(group.batchNumber) && !processedBatchNumbers.has(group.batchNumber)) {
            processedBatchNumbers.add(group.batchNumber);
            // Tanggal selesai batch diisi syncBatchCompletedDates (satu aturan di satu tempat)
            newBatchesToInsert.push([
                group.batchNumber,
                group.idProduct,
                null,
                null,
                null,
                group.expiredDate || null,
                'Open',
                userId,
                userId
            ]);
        }
    });

    if (problems.length > 0) {
        throw new BusinessError('Allocation validation failed.', 422, { problems });
    }

    if (newBatchesToInsert.length > 0) {
        await connection.query(
            `INSERT INTO batches (batch_number, id_product, plan_production_date, actual_production_date, actual_completed_date, expired_date, status, created_by, updated_by)
             VALUES ?`,
            [newBatchesToInsert]
        );
        const [createdBatches] = await connection.query(
            'SELECT id, batch_number FROM batches WHERE batch_number IN (?)',
            [[...processedBatchNumbers]]
        );
        createdBatches.forEach((b) => batchIdByNumber.set(b.batch_number, b.id));
    }

    // Tanggal selesai batch = MAX dari seluruh baris upload batch tersebut (termasuk upload sebelumnya)
    await syncBatchCompletedDates(connection, batchNumbers, userId);

    // 5. Upsert ke `po_lot_allocations` (satu baris per item PO + lot + batch)
    const items = new Map();
    detailedAllocations.forEach((a) => {
        const lotId = lotIdByKey.get(lotKey(a.lotNumber, a.idProduct));
        // Jenis berbasis lot mengurangi alokasi pada batch lain yang tidak ada di file: batchId datang dari alokasinya
        const batchId = a.batchId || batchIdByNumber.get(a.batchNumber);
        if (!lotId || !batchId || !a.poDetailId) {
            problems.push(`Missing lot, batch, or PO detail reference for lot ${a.lotNumber} / batch ${a.batchNumber}.`);
            return;
        }
        const key = allocationKey(a.poDetailId, lotId, batchId);
        const current = items.get(key);
        const step = {
            delta: Number(a.addedQty) || 0,
            transType: a.transType || null,
            docSource: a.docSource || '',
            status: a.rowStatus
        };
        if (current) {
            current.addedQty += step.delta;
            current.rowStatus = a.rowStatus;
            if (a.transType && !current.transTypes.includes(a.transType)) current.transTypes.push(a.transType);
            current.rawSteps.push(step);
        } else {
            items.set(key, {
                poDetailId: a.poDetailId,
                lotId,
                batchId,
                addedQty: step.delta,
                rowStatus: a.rowStatus,
                transTypes: a.transType ? [a.transType] : [],
                rawSteps: [step]
            });
        }
    });

    // Riwayat per Doc Source hanya bila ada Doc Source; tanpa itu satu baris per alokasi (perilaku lama)
    items.forEach((item) => {
        if (item.rawSteps.some((st) => st.docSource)) item.steps = mergeLogSteps(item.rawSteps);
        delete item.rawSteps;
    });

    // 5-8. Upsert po_lot_allocations, riwayat, fulfilled_qty, sinkron status, refresh batch dan header PO
    const { allocationCount } = await persistAllocationItems(connection, {
        items,
        userId,
        uploadLogId,
        reason: uploadReason,
        syncReason: SYNC_REASON,
        problems,
        extraBatchIds: previewResults.map((g) => batchIdByNumber.get(g.batchNumber)).filter(Boolean)
    });

    return {
        uploadLogId,
        savedBatchCount: batchNumbers.length,
        savedLotCount: previewResults.length,
        savedRowCount: newRows.length,
        allocationCount
    };
};

module.exports = {
    commitProductionAllocationTransaction
};
