const { chunk } = require('../../helpers/arrayUtils');
const { BusinessError } = require('../../helpers/businessError');
const {
    refreshPOStatus,
    refreshBatchStatuses,
    recalculateFulfilledQty,
    syncBatchCompletedDates
} = require('./lotStatusService');
const { logAllocationInsert, logAllocationUpdate } = require('./lotAllocationLog');
const {
    ALLOCATION_STATUS,
    ELIGIBLE_ALLOCATION_STATUSES,
    allocationKey,
    lotKey
} = require('./lotAllocationRules');

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
            detail.batchNumber,
            detail.lotNumber || '',
            detail.itemCode,
            detail.lotStatus || null,
            detail.transType || null,
            detail.qtyPac || 0,
            detail.actualCompletedDatetime || null,
            detail.expiredDate || null,
            detail.rowHash
        ]);
        await connection.query(
            `INSERT INTO production_lot_upload_details
            (upload_log_id, batch_number, lot_number, item_code, lot_status, trans_type, qty_pac, actual_completed_datetime, expired_date, row_hash)
            VALUES ?`,
            [detailValues]
        );
    }

    // 3. Upsert master lot (unik per nomor lot + produk).
    //    Tanggal selesai lot = yang terbaru; expired_date yang sudah terisi tidak ditimpa.
    const lotRows = new Map();
    previewResults.forEach((group) => {
        if (!group.lotNumber || !group.idProduct) return;

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

        const lotNumbers = [...new Set([...lotRows.values()].map((row) => row[0]))];
        for (const part of chunk(lotNumbers, 500)) {
            const [rows] = await connection.query(
                'SELECT id, lot_number, id_product FROM lots WHERE lot_number IN (?)',
                [part]
            );
            rows.forEach((l) => lotIdByKey.set(lotKey(l.lot_number, l.id_product), l.id));
        }
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
        if (!group.batchNumber) return;

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
        const batchId = batchIdByNumber.get(a.batchNumber);
        if (!lotId || !batchId || !a.poDetailId) {
            problems.push(`Missing lot, batch, or PO detail reference for lot ${a.lotNumber} / batch ${a.batchNumber}.`);
            return;
        }
        const key = allocationKey(a.poDetailId, lotId, batchId);
        const current = items.get(key);
        if (current) {
            current.addedQty += Number(a.addedQty) || 0;
            current.rowStatus = a.rowStatus;
        } else {
            items.set(key, {
                poDetailId: a.poDetailId,
                lotId,
                batchId,
                addedQty: Number(a.addedQty) || 0,
                rowStatus: a.rowStatus
            });
        }
    });

    const lotIds = [...new Set([...items.values()].map((i) => i.lotId))];
    const [existingAllocRows] = await connection.query(
        'SELECT id, po_detail_id, lot_id, id_batch, allocated_qty, status FROM po_lot_allocations WHERE lot_id IN (?) FOR UPDATE',
        [lotIds.length > 0 ? lotIds : [0]]
    );
    const existingByPair = new Map(existingAllocRows.map((a) => [allocationKey(a.po_detail_id, a.lot_id, a.id_batch), a]));

    const upsertValues = [];
    const insertLogs = [];
    const updateLogs = [];

    items.forEach((item, key) => {
        const existing = existingByPair.get(key);
        const oldQty = existing ? Number(existing.allocated_qty) || 0 : 0;
        const newQty = oldQty + item.addedQty;

        if (newQty < 0) {
            problems.push(`Allocation for PO detail ${item.poDetailId}, lot ID ${item.lotId}, batch ID ${item.batchId} would become negative.`);
            return;
        }
        if (existing && !ELIGIBLE_ALLOCATION_STATUSES.includes(existing.status)) {
            problems.push(`Allocation for PO detail ${item.poDetailId}, lot ID ${item.lotId}, batch ID ${item.batchId} is ${existing.status} and cannot be changed.`);
            return;
        }

        upsertValues.push([item.poDetailId, item.lotId, item.batchId, newQty, item.rowStatus, userId, userId]);

        if (existing) {
            updateLogs.push({
                upload_log_id: uploadLogId,
                allocation_id: existing.id,
                po_detail_id: item.poDetailId,
                lot_id: item.lotId,
                id_batch: item.batchId,
                old_allocated_qty: oldQty,
                new_allocated_qty: newQty,
                old_status: existing.status,
                new_status: item.rowStatus,
                reason: uploadReason,
                created_by: userId
            });
        } else {
            insertLogs.push({
                upload_log_id: uploadLogId,
                po_detail_id: item.poDetailId,
                lot_id: item.lotId,
                id_batch: item.batchId,
                allocated_qty: newQty,
                status: item.rowStatus,
                reason: uploadReason,
                created_by: userId
            });
        }
    });

    if (problems.length > 0) {
        throw new BusinessError('Allocation validation failed.', 422, { problems });
    }

    if (upsertValues.length > 0) {
        await connection.query(
            `INSERT INTO po_lot_allocations (po_detail_id, lot_id, id_batch, allocated_qty, status, created_by, updated_by)
             VALUES ?
             ON DUPLICATE KEY UPDATE
                allocated_qty = VALUES(allocated_qty),
                status = VALUES(status),
                updated_by = VALUES(updated_by)`,
            [upsertValues]
        );
    }

    // Catat Log Alokasi
    if (insertLogs.length > 0) {
        const triples = insertLogs.map((l) => [l.po_detail_id, l.lot_id, l.id_batch]);
        const [createdAllocs] = await connection.query(
            'SELECT id, po_detail_id, lot_id, id_batch FROM po_lot_allocations WHERE (po_detail_id, lot_id, id_batch) IN (?)',
            [triples]
        );
        const idByKey = new Map(createdAllocs.map((a) => [allocationKey(a.po_detail_id, a.lot_id, a.id_batch), a.id]));
        insertLogs.forEach((l) => {
            l.allocation_id = idByKey.get(allocationKey(l.po_detail_id, l.lot_id, l.id_batch));
        });
        await logAllocationInsert(connection, insertLogs, userId);
    }
    if (updateLogs.length > 0) {
        await logAllocationUpdate(connection, updateLogs, userId);
    }

    // 6. Hitung Ulang fulfilled_qty pada `po_details` dari `po_lot_allocations`
    const poDetailIds = [...new Set([...items.values()].map((i) => i.poDetailId))];
    await recalculateFulfilledQty(connection, poDetailIds);

    const [poDetailRows] = await connection.query(
        'SELECT po_detail_id, po_header_id, base_qty, fulfilled_qty FROM po_details WHERE po_detail_id IN (?)',
        [poDetailIds.length > 0 ? poDetailIds : [0]]
    );

    const poHeaderIds = new Set();
    const targetStatusByDetail = new Map();
    poDetailRows.forEach((pd) => {
        const base = Number(pd.base_qty) || 0;
        const fulfilled = Number(pd.fulfilled_qty) || 0;
        if (fulfilled > base || fulfilled < 0) {
            problems.push(`PO detail ${pd.po_detail_id} would have fulfilled quantity ${fulfilled} against PO quantity ${base}.`);
        }
        if (pd.po_header_id) poHeaderIds.add(pd.po_header_id);
        targetStatusByDetail.set(pd.po_detail_id, fulfilled >= base ? ALLOCATION_STATUS.CLOSED : ALLOCATION_STATUS.OPEN);
    });

    if (problems.length > 0) {
        throw new BusinessError(
            'The allocation would exceed or go below the PO quantity limits. Please upload the file again to refresh the preview.',
            409,
            { problems }
        );
    }

    // 7. Sinkronisasi status dua arah untuk seluruh alokasi (lot, batch) pada item PO yang sama
    const [relatedAllocs] = await connection.query(
        `SELECT id, po_detail_id, lot_id, id_batch, allocated_qty, status
         FROM po_lot_allocations
         WHERE po_detail_id IN (?) AND status IN (?)`,
        [poDetailIds.length > 0 ? poDetailIds : [0], ELIGIBLE_ALLOCATION_STATUSES]
    );

    const idsByTargetStatus = new Map([
        [ALLOCATION_STATUS.CLOSED, []],
        [ALLOCATION_STATUS.OPEN, []]
    ]);
    const syncLogs = [];

    // Kumpulkan batch ID dari file saat ini DAN dari alokasi yang ikut tersinkronisasi
    const allBatchIdsToRefresh = new Set(
        previewResults.map((g) => batchIdByNumber.get(g.batchNumber)).filter(Boolean)
    );

    relatedAllocs.forEach((a) => {
        const target = targetStatusByDetail.get(a.po_detail_id);
        if (!target || a.status === target) return;

        // Ikutkan batch alokasi ini ke antrean refresh karena statusnya berubah
        allBatchIdsToRefresh.add(a.id_batch);

        idsByTargetStatus.get(target).push(a.id);
        syncLogs.push({
            upload_log_id: uploadLogId,
            allocation_id: a.id,
            po_detail_id: a.po_detail_id,
            lot_id: a.lot_id,
            id_batch: a.id_batch,
            old_allocated_qty: Number(a.allocated_qty) || 0,
            new_allocated_qty: Number(a.allocated_qty) || 0,
            old_status: a.status,
            new_status: target,
            reason: SYNC_REASON,
            created_by: userId
        });
    });

    for (const [status, ids] of idsByTargetStatus.entries()) {
        if (ids.length === 0) continue;
        await connection.query(
            `UPDATE po_lot_allocations SET status = ?, updated_by = ? WHERE id IN (?)`,
            [status, userId, ids]
        );
    }
    if (syncLogs.length > 0) {
        await logAllocationUpdate(connection, syncLogs, userId);
    }

    // 8. Refresh status Batch & Header PO
    if (allBatchIdsToRefresh.size > 0) {
        await refreshBatchStatuses(connection, [...allBatchIdsToRefresh]);
    }

    for (const poHeaderId of poHeaderIds) {
        await refreshPOStatus(connection, poHeaderId);
    }

    return {
        uploadLogId,
        savedBatchCount: batchNumbers.length,
        savedLotCount: previewResults.length,
        savedRowCount: newRows.length,
        allocationCount: upsertValues.length
    };
};

module.exports = {
    commitProductionAllocationTransaction
};
