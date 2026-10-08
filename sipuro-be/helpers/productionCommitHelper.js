const { refreshPOStatus, refreshBatchStatuses } = require('./batchHelper');
const { logAllocationInsert, logAllocationUpdate } = require('./poBatchAllocationLogHelper');
const { BusinessError } = require('./businessError');

const SYNC_REASON = 'Auto status sync after production upload';

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

// Tanggal (YYYY-MM-DD) dari string datetime Excel; start selalu terisi karena grup tanpa tanggal tidak dialokasikan
const dateOnly = (value) => (typeof value === 'string' ? value.split('T')[0].split(' ')[0] : value);

/**
 * Menyimpan hasil perhitungan alokasi ke database.
 * `calculation` adalah hasil calculateFifoAllocation yang SUDAH dihitung ulang server di dalam transaksi ini.
 * Dipanggil di dalam transaksi (BEGIN/COMMIT/ROLLBACK diatur controller).
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
    const uploadReason = `Production upload: ${fileName || 'unnamed file'}`;
    const problems = [];

    // 1. Log upload file (UNIQUE file_hash / process_timestamp menjaga dari commit ganda)
    const [uploadLogResult] = await connection.query(
        'INSERT INTO production_upload_logs (file_name, process_timestamp, file_hash, uploaded_by) VALUES (?, ?, ?, ?)',
        [fileName, processTimestamp, fileHash || null, userId]
    );
    const uploadLogId = uploadLogResult.insertId;

    // 2. Simpan baris Excel yang teralokasi
    for (const part of chunk(newRows, 500)) {
        const detailValues = part.map((detail) => [
            uploadLogId,
            detail.batchNumber,
            detail.lotNumber || null,
            detail.itemCode,
            detail.lotStatus || null,
            detail.qtyPac || 0,
            detail.actualStartDatetime || null,
            detail.actualCompletedDatetime || null,
            detail.rowHash
        ]);
        await connection.query(
            `INSERT INTO production_upload_details 
            (upload_log_id, batch_number, lot_number, item_code, lot_status, qty_pac, actual_start_datetime, actual_completed_datetime, row_hash) 
            VALUES ?`,
            [detailValues]
        );
    }

    // 3. Find-or-create master batch (hanya untuk grup yang teralokasi)
    const batchNumbers = previewResults.map((b) => b.batchNumber);
    const batchIdByNumber = new Map();
    const [existingBatchRows] = await connection.query(
        'SELECT id, batch_number, id_product FROM batches WHERE batch_number IN (?)',
        [batchNumbers]
    );
    existingBatchRows.forEach((b) => {
        batchIdByNumber.set(b.batch_number, b.id);
    });

    const existingByNumber = new Map(existingBatchRows.map((b) => [b.batch_number, b]));
    const newBatchValues = [];
    previewResults.forEach((group) => {
        const existing = existingByNumber.get(group.batchNumber);
        if (existing) {
            if (Number(existing.id_product) !== Number(group.idProduct)) {
                problems.push(`Batch ${group.batchNumber} already belongs to another product.`);
            }
            return;
        }
        if (!group.idProduct) {
            problems.push(`Product ${group.productCode} was not found for batch ${group.batchNumber}.`);
            return;
        }
        newBatchValues.push([
            group.batchNumber,
            group.idProduct,
            dateOnly(group.actualStartDatetime),
            group.actualStartDatetime || null,
            group.actualCompletedDatetime || null,
            'Open',
            userId
        ]);
    });

    if (problems.length > 0) {
        throw new BusinessError('Allocation validation failed.', 422, { problems });
    }

    if (newBatchValues.length > 0) {
        await connection.query(
            `INSERT INTO batches (batch_number, id_product, plan_production_date, actual_production_date, actual_completed_date, status, created_by)
             VALUES ?`,
            [newBatchValues]
        );
        const [createdBatches] = await connection.query(
            'SELECT id, batch_number FROM batches WHERE batch_number IN (?)',
            [newBatchValues.map((v) => v[0])]
        );
        createdBatches.forEach((b) => batchIdByNumber.set(b.batch_number, b.id));
    }

    // 4. Upsert po_batch_allocations (akumulasi allocated_qty, plus maupun minus)
    const items = new Map();
    detailedAllocations.forEach((a) => {
        const batchId = batchIdByNumber.get(a.batchNumber);
        if (!batchId || !a.poDetailId) {
            problems.push(`Missing batch or PO detail reference for batch ${a.batchNumber}.`);
            return;
        }
        const key = `${a.poDetailId}_${batchId}`;
        const current = items.get(key);
        if (current) {
            current.addedQty += Number(a.addedQty) || 0;
            current.rowStatus = a.rowStatus;
        } else {
            items.set(key, {
                poDetailId: a.poDetailId,
                batchId,
                addedQty: Number(a.addedQty) || 0,
                rowStatus: a.rowStatus
            });
        }
    });

    const batchIds = [...new Set([...items.values()].map((i) => i.batchId))];
    const [existingAllocRows] = await connection.query(
        'SELECT id, po_detail_id, id_batch, allocated_qty, status FROM po_batch_allocations WHERE id_batch IN (?) FOR UPDATE',
        [batchIds]
    );
    const existingByPair = new Map(existingAllocRows.map((a) => [`${a.po_detail_id}_${a.id_batch}`, a]));

    const upsertValues = [];
    const insertLogs = [];
    const updateLogs = [];

    items.forEach((item, key) => {
        const existing = existingByPair.get(key);
        const oldQty = existing ? Number(existing.allocated_qty) || 0 : 0;
        const newQty = oldQty + item.addedQty;

        if (newQty < 0) {
            problems.push(`Allocation for PO detail ${item.poDetailId} and batch ${item.batchId} would become negative.`);
            return;
        }
        if (existing && !['Open', 'Closed'].includes(existing.status)) {
            problems.push(`Allocation for PO detail ${item.poDetailId} and batch ${item.batchId} is ${existing.status} and cannot be changed.`);
            return;
        }

        upsertValues.push([item.poDetailId, item.batchId, newQty, item.rowStatus, userId, userId]);

        if (existing) {
            updateLogs.push({
                upload_log_id: uploadLogId,
                allocation_id: existing.id,
                po_detail_id: item.poDetailId,
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
            `INSERT INTO po_batch_allocations (po_detail_id, id_batch, allocated_qty, status, created_by, updated_by)
             VALUES ?
             ON DUPLICATE KEY UPDATE
                allocated_qty = VALUES(allocated_qty),
                status = VALUES(status),
                updated_by = VALUES(updated_by)`,
            [upsertValues]
        );
    }

    // Ambil id alokasi baru untuk log
    if (insertLogs.length > 0) {
        const pairs = insertLogs.map((l) => [l.po_detail_id, l.id_batch]);
        const [createdAllocs] = await connection.query(
            'SELECT id, po_detail_id, id_batch FROM po_batch_allocations WHERE (po_detail_id, id_batch) IN (?)',
            [pairs]
        );
        const idByPair = new Map(createdAllocs.map((a) => [`${a.po_detail_id}_${a.id_batch}`, a.id]));
        insertLogs.forEach((l) => {
            l.allocation_id = idByPair.get(`${l.po_detail_id}_${l.id_batch}`);
        });
        await logAllocationInsert(connection, insertLogs, userId);
    }
    if (updateLogs.length > 0) {
        await logAllocationUpdate(connection, updateLogs, userId);
    }

    // 5. Tanggal produksi aktual pada batches = MIN start / MAX completed dari seluruh detail tersimpan
    await connection.query(
        `UPDATE batches b
         JOIN (
            SELECT batch_number,
                   MIN(actual_start_datetime) AS min_start,
                   MAX(actual_completed_datetime) AS max_completed
            FROM production_upload_details
            WHERE batch_number IN (?)
            GROUP BY batch_number
         ) d ON d.batch_number = b.batch_number
         SET b.actual_production_date = COALESCE(d.min_start, b.actual_production_date),
             b.actual_completed_date = COALESCE(d.max_completed, b.actual_completed_date),
             b.updated_by = ?`,
        [batchNumbers, userId]
    );

    // 6. Recalculate fulfilled_qty pada po_details
    const poDetailIds = [...new Set([...items.values()].map((i) => i.poDetailId))];
    await connection.query(
        `UPDATE po_details d
         SET d.fulfilled_qty = (
             SELECT COALESCE(SUM(pba.allocated_qty), 0)
             FROM po_batch_allocations pba
             WHERE pba.po_detail_id = d.po_detail_id AND pba.status <> 'Canceled'
         )
         WHERE d.po_detail_id IN (?)`,
        [poDetailIds]
    );

    const [poDetailRows] = await connection.query(
        'SELECT po_detail_id, po_header_id, base_qty, fulfilled_qty FROM po_details WHERE po_detail_id IN (?)',
        [poDetailIds]
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

    // 7. Sinkronisasi status dua arah untuk SELURUH alokasi Open/Closed milik PO detail terkait
    //    (alokasi Force Closed / Canceled tidak disentuh)
    const batchIdsToRefresh = new Set(batchIds);
    const [relatedAllocs] = await connection.query(
        `SELECT id, po_detail_id, id_batch, allocated_qty, status
         FROM po_batch_allocations
         WHERE po_detail_id IN (?) AND status IN ('Open', 'Closed')`,
        [poDetailIds]
    );

    const changedToClosed = [];
    const changedToOpen = [];
    const syncLogs = [];
    relatedAllocs.forEach((a) => {
        const target = targetStatusByDetail.get(a.po_detail_id);
        if (!target || a.status === target) return;
        (target === 'Closed' ? changedToClosed : changedToOpen).push(a.id);
        batchIdsToRefresh.add(a.id_batch);
        syncLogs.push({
            upload_log_id: uploadLogId,
            allocation_id: a.id,
            po_detail_id: a.po_detail_id,
            id_batch: a.id_batch,
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
            `UPDATE po_batch_allocations SET status = 'Closed', updated_by = ? WHERE id IN (?)`,
            [userId, changedToClosed]
        );
    }
    if (changedToOpen.length > 0) {
        await connection.query(
            `UPDATE po_batch_allocations SET status = 'Open', updated_by = ? WHERE id IN (?)`,
            [userId, changedToOpen]
        );
    }
    if (syncLogs.length > 0) {
        await logAllocationUpdate(connection, syncLogs, userId);
    }

    // 8. Refresh status induk batch dan header PO
    await refreshBatchStatuses(connection, [...batchIdsToRefresh]);
    for (const poHeaderId of poHeaderIds) {
        await refreshPOStatus(connection, poHeaderId);
    }

    return {
        uploadLogId,
        savedBatchCount: previewResults.length,
        savedRowCount: newRows.length,
        allocationCount: upsertValues.length
    };
};

module.exports = {
    commitProductionAllocationTransaction
};
