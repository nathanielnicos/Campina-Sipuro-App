const { refreshPOStatus, refreshBatchStatuses } = require('../batchHelper');
const { logAllocationInsert, logAllocationUpdate } = require('../poLotAllocationLogHelper');
const { BusinessError } = require('../businessError');

const SYNC_REASON = 'Auto status sync after production lot upload';

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

// Ambil tanggal (YYYY-MM-DD) dari string datetime
const dateOnly = (value) => (typeof value === 'string' ? value.split('T')[0].split(' ')[0] : value);

/**
 * Menyimpan hasil perhitungan alokasi lot ke database menggunakan tabel-tabel baru (lot-centric) berdasarkan sipuro_db.sql.
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

    // 1. Log upload ke tabel production_lot_upload_logs
    const [uploadLogResult] = await connection.query(
        'INSERT INTO production_lot_upload_logs (file_name, process_timestamp, file_hash, uploaded_by) VALUES (?, ?, ?, ?)',
        [fileName, processTimestamp, fileHash || null, userId]
    );
    const uploadLogId = uploadLogResult.insertId;

    // 2. Simpan detail baris Excel ke tabel production_lot_upload_details
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

    // 3. Find-or-Create Master Lots (tabel `lots`)
    const lotMap = new Map(); // Key: `${batchNumber}_${lotNumber}_${productCode}` -> lotId
    const lotNumbers = [...new Set(newRows.map((r) => r.lotNumber).filter(Boolean))];

    const [existingLots] = await connection.query(
        'SELECT id, lot_number, id_product FROM lots WHERE lot_number IN (?)',
        [lotNumbers.length > 0 ? lotNumbers : ['']]
    );
    const existingLotByKey = new Map();
    existingLots.forEach((l) => existingLotByKey.set(`${l.lot_number}_${l.id_product}`, l.id));

    const newLotValues = [];
    previewResults.forEach((group) => {
        const key = `${group.lotNumber}_${group.idProduct}`;
        if (existingLotByKey.has(key)) {
            lotMap.set(`${group.batchNumber}_${group.lotNumber}_${group.productCode}`, existingLotByKey.get(key));
        } else {
            if (!group.idProduct) {
                problems.push(`Product ${group.productCode} was not found for lot ${group.lotNumber}.`);
                return;
            }
            newLotValues.push([
                group.lotNumber,
                group.idProduct,
                group.actualCompletedDatetime || null,
                group.expiredDate || null
            ]);
        }
    });

    if (problems.length > 0) {
        throw new BusinessError('Allocation validation failed.', 422, { problems });
    }

    if (newLotValues.length > 0) {
        await connection.query(
            `INSERT INTO lots (lot_number, id_product, actual_completed_datetime, expired_date) VALUES ?`,
            [newLotValues]
        );
        const [createdLots] = await connection.query(
            'SELECT id, lot_number, id_product FROM lots WHERE lot_number IN (?)',
            [lotNumbers.length > 0 ? lotNumbers : ['']]
        );
        createdLots.forEach((l) => existingLotByKey.set(`${l.lot_number}_${l.id_product}`, l.id));
    }

    // Petakan ulang lotMap untuk grup yang baru dibuat
    previewResults.forEach((group) => {
        const key = `${group.lotNumber}_${group.idProduct}`;
        const lotId = existingLotByKey.get(key);
        if (lotId) {
            lotMap.set(`${group.batchNumber}_${group.lotNumber}_${group.productCode}`, lotId);
        }
    });

    // 3.5 Find-or-Create Master Batches (tabel `batches`) & Relasi ke `batch_lots`
    const batchNumbers = [...new Set(previewResults.map((g) => g.batchNumber))];
    const [existingBatches] = await connection.query(
        'SELECT id, batch_number, id_product FROM batches WHERE batch_number IN (?)',
        [batchNumbers.length > 0 ? batchNumbers : ['']]
    );
    const batchIdByNumber = new Map();
    existingBatches.forEach((b) => batchIdByNumber.set(b.batch_number, b.id));

    const newBatchValues = [];
    previewResults.forEach((group) => {
        if (!batchIdByNumber.has(group.batchNumber)) {
            const completedDateOnly = dateOnly(group.actualCompletedDatetime);
            newBatchValues.push([
                group.batchNumber,
                group.idProduct,
                completedDateOnly || new Date().toISOString().split('T')[0], // plan_production_date
                group.actualCompletedDatetime || null, // actual_production_date
                group.actualCompletedDatetime || null, // actual_completed_date
                group.expiredDate || null,             // expired_date
                'Open',
                userId,
                userId
            ]);
        }
    });

    if (newBatchValues.length > 0) {
        await connection.query(
            `INSERT INTO batches (batch_number, id_product, plan_production_date, actual_production_date, actual_completed_date, expired_date, status, created_by, updated_by)
             VALUES ?`,
            [newBatchValues]
        );
        const [createdBatches] = await connection.query(
            'SELECT id, batch_number FROM batches WHERE batch_number IN (?)',
            [batchNumbers.length > 0 ? batchNumbers : ['']]
        );
        createdBatches.forEach((b) => batchIdByNumber.set(b.batch_number, b.id));
    }

    // Masukkan relasi ke tabel `batch_lots`
    const batchLotValues = [];
    previewResults.forEach((group) => {
        const batchId = batchIdByNumber.get(group.batchNumber);
        const lotId = lotMap.get(`${group.batchNumber}_${group.lotNumber}_${group.productCode}`);
        if (batchId && lotId) {
            batchLotValues.push([batchId, lotId]);
        }
    });

    if (batchLotValues.length > 0) {
        await connection.query(
            `INSERT INTO batch_lots (batch_id, lot_id) VALUES ? 
             ON DUPLICATE KEY UPDATE id = id`,
            [batchLotValues]
        );
    }

    // Kumpulkan batch ID yang terlibat untuk direfresh statusnya nanti
    const batchIdsToRefresh = [...new Set(previewResults.map((g) => batchIdByNumber.get(g.batchNumber)).filter(Boolean))];

    // 4. Upsert ke tabel `po_lot_allocations` + siapkan Log Data
    const items = new Map();
    detailedAllocations.forEach((a) => {
        const lotKey = `${a.batchNumber}_${a.lotNumber}_${a.productCode}`;
        const lotId = lotMap.get(lotKey);
        if (!lotId || !a.poDetailId) {
            problems.push(`Missing lot or PO detail reference for lot ${a.lotNumber}.`);
            return;
        }
        const key = `${a.poDetailId}_${lotId}`;
        const current = items.get(key);
        if (current) {
            current.addedQty += Number(a.addedQty) || 0;
            current.rowStatus = a.rowStatus;
        } else {
            items.set(key, {
                poDetailId: a.poDetailId,
                lotId,
                addedQty: Number(a.addedQty) || 0,
                rowStatus: a.rowStatus
            });
        }
    });

    const lotIds = [...new Set([...items.values()].map((i) => i.lotId))];
    const [existingAllocRows] = await connection.query(
        'SELECT id, po_detail_id, lot_id, allocated_qty, status FROM po_lot_allocations WHERE lot_id IN (?) FOR UPDATE',
        [lotIds.length > 0 ? lotIds : [0]]
    );
    const existingByPair = new Map(existingAllocRows.map((a) => [`${a.po_detail_id}_${a.lot_id}`, a]));

    const upsertValues = [];
    const insertLogs = [];
    const updateLogs = [];

    items.forEach((item, key) => {
        const existing = existingByPair.get(key);
        const oldQty = existing ? Number(existing.allocated_qty) || 0 : 0;
        const newQty = oldQty + item.addedQty;

        if (newQty < 0) {
            problems.push(`Allocation for PO detail ${item.poDetailId} and lot ID ${item.lotId} would become negative.`);
            return;
        }
        if (existing && !['Open', 'Closed'].includes(existing.status)) {
            problems.push(`Allocation for PO detail ${item.poDetailId} and lot ID ${item.lotId} is ${existing.status} and cannot be changed.`);
            return;
        }

        upsertValues.push([item.poDetailId, item.lotId, newQty, item.rowStatus, userId, userId]);

        if (existing) {
            updateLogs.push({
                upload_log_id: uploadLogId,
                allocation_id: existing.id,
                po_detail_id: item.poDetailId,
                lot_id: item.lotId,
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
            `INSERT INTO po_lot_allocations (po_detail_id, lot_id, allocated_qty, status, created_by, updated_by)
             VALUES ?
             ON DUPLICATE KEY UPDATE
                allocated_qty = VALUES(allocated_qty),
                status = VALUES(status),
                updated_by = VALUES(updated_by)`,
            [upsertValues]
        );
    }

    // Catat Log Insert / Update
    if (insertLogs.length > 0) {
        const pairs = insertLogs.map((l) => [l.po_detail_id, l.lot_id]);
        const [createdAllocs] = await connection.query(
            'SELECT id, po_detail_id, lot_id FROM po_lot_allocations WHERE (po_detail_id, lot_id) IN (?)',
            [pairs]
        );
        const idByPair = new Map(createdAllocs.map((a) => [`${a.po_detail_id}_${a.lot_id}`, a.id]));
        insertLogs.forEach((l) => {
            l.allocation_id = idByPair.get(`${l.po_detail_id}_${l.lot_id}`);
        });
        await logAllocationInsert(connection, insertLogs, userId);
    }
    if (updateLogs.length > 0) {
        await logAllocationUpdate(connection, updateLogs, userId);
    }

    // 5. Recalculate fulfilled_qty pada `po_details` bersumber dari `po_lot_allocations`
    const poDetailIds = [...new Set([...items.values()].map((i) => i.poDetailId))];
    await connection.query(
        `UPDATE po_details d
         SET d.fulfilled_qty = (
             SELECT COALESCE(SUM(pla.allocated_qty), 0)
             FROM po_lot_allocations pla
             WHERE pla.po_detail_id = d.po_detail_id AND pla.status <> 'Canceled'
         )
         WHERE d.po_detail_id IN (?)`,
        [poDetailIds.length > 0 ? poDetailIds : [0]]
    );

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
        targetStatusByDetail.set(pd.po_detail_id, fulfilled >= base ? 'Closed' : 'Open');
    });

    if (problems.length > 0) {
        throw new BusinessError(
            'The allocation would exceed or go below the PO quantity limits. Please upload the file again to refresh the preview.',
            409,
            { problems }
        );
    }

    // 6. Sinkronisasi status dua arah untuk `po_lot_allocations`
    const [relatedAllocs] = await connection.query(
        `SELECT id, po_detail_id, lot_id, allocated_qty, status
         FROM po_lot_allocations
         WHERE po_detail_id IN (?) AND status IN ('Open', 'Closed')`,
        [poDetailIds.length > 0 ? poDetailIds : [0]]
    );

    const changedToClosed = [];
    const changedToOpen = [];
    const syncLogs = [];
    relatedAllocs.forEach((a) => {
        const target = targetStatusByDetail.get(a.po_detail_id);
        if (!target || a.status === target) return;
        (target === 'Closed' ? changedToClosed : changedToOpen).push(a.id);
        syncLogs.push({
            upload_log_id: uploadLogId,
            allocation_id: a.id,
            po_detail_id: a.po_detail_id,
            lot_id: a.lot_id,
            old_allocated_qty: Number(a.allocated_qty) || 0,
            new_allocated_qty: Number(a.allocated_qty) || 0,
            old_status: a.status,
            new_status: target,
            reason: SYNC_REASON,
            created_by: userId
        });
    });

    if (changedToClosed.length > 0) {
        await connection.query(
            `UPDATE po_lot_allocations SET status = 'Closed', updated_by = ? WHERE id IN (?)`,
            [userId, changedToClosed]
        );
    }
    if (changedToOpen.length > 0) {
        await connection.query(
            `UPDATE po_lot_allocations SET status = 'Open', updated_by = ? WHERE id IN (?)`,
            [userId, changedToOpen]
        );
    }
    if (syncLogs.length > 0) {
        await logAllocationUpdate(connection, syncLogs, userId);
    }

    // 7. Refresh status induk batch dan header PO
    if (batchIdsToRefresh.length > 0) {
        await refreshBatchStatuses(connection, batchIdsToRefresh);
    }
    for (const poHeaderId of poHeaderIds) {
        await refreshPOStatus(connection, poHeaderId);
    }

    return {
        uploadLogId,
        savedBatchCount: batchNumbers.length,
        savedRowCount: newRows.length,
        allocationCount: upsertValues.length
    };
};

module.exports = {
    commitProductionAllocationTransaction
};
