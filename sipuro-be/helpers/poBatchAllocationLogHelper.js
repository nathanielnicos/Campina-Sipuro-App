/**
 * Helper untuk mencatat riwayat/audit trail pada tabel po_batch_allocation_logs
 */

/**
 * Log saat alokasi PO - Batch baru dibuat (INSERT)
 * @param {Object} connection - Database connection / transaction
 * @param {Array|Object} allocations - Single object atau Array object alokasi
 * @param {number|null} createdBy - User ID yang melakukan alokasi
 */
exports.logAllocationInsert = async (connection, allocations, createdBy = null) => {
    const items = Array.isArray(allocations) ? allocations : [allocations];
    if (items.length === 0) return;

    const values = items.map(item => [
        item.upload_log_id || item.uploadLogId || null,
        item.allocation_id || item.id,
        item.po_detail_id || item.poDetailId,
        item.id_batch || item.idBatch || item.batchId,
        'INSERT',
        0,                                                  // old_fulfilled_qty
        item.fulfilled_qty || item.allocated_qty || 0,      // new_fulfilled_qty
        null,                                               // old_status
        item.status || 'Open',                              // new_status
        item.reason || null,
        createdBy || item.created_by || item.createdBy || null
    ]);

    const query = `
        INSERT INTO sipuro_db.po_batch_allocation_logs 
        (
            upload_log_id, allocation_id, po_detail_id, id_batch, action_type,
            old_fulfilled_qty, new_fulfilled_qty, old_status, new_status,
            reason, created_by
        ) 
        VALUES ?
    `;

    await connection.query(query, [values]);
};

/**
 * Log saat alokasi PO - Batch diperbarui / dibatalkan / force close / upload excel (UPDATE)
 * @param {Object} connection - Database connection / transaction
 * @param {Array|Object} updates - Single object atau Array object update alokasi
 * @param {number|null} createdBy - User ID yang melakukan aksi
 */
exports.logAllocationUpdate = async (connection, updates, createdBy = null) => {
    const items = Array.isArray(updates) ? updates : [updates];
    if (items.length === 0) return;

    const values = items.map(item => [
        item.upload_log_id || item.uploadLogId || null,
        item.allocation_id || item.allocationId || item.id,
        item.po_detail_id || item.poDetailId,
        item.id_batch || item.batchId || item.idBatch,
        'UPDATE',
        item.old_fulfilled_qty !== undefined ? item.old_fulfilled_qty : (item.oldFulfilledQty || 0),
        item.new_fulfilled_qty !== undefined ? item.new_fulfilled_qty : (item.newFulfilledQty || 0),
        item.old_status || item.oldStatus || null,
        item.new_status || item.newStatus || null,
        item.reason || null,
        createdBy || item.created_by || item.createdBy || null
    ]);

    const query = `
        INSERT INTO sipuro_db.po_batch_allocation_logs 
        (
            upload_log_id, allocation_id, po_detail_id, id_batch, action_type,
            old_fulfilled_qty, new_fulfilled_qty, old_status, new_status,
            reason, created_by
        ) 
        VALUES ?
    `;

    await connection.query(query, [values]);
};
