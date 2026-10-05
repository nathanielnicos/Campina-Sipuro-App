/**
 * Helper untuk mencatat riwayat/audit trail pada tabel po_batch_allocation_logs
 */

/**
 * Log saat alokasi PO - Batch baru dibuat (INSERT)
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
        0,
        Number(item.allocated_qty) || 0,
        null,
        item.status || 'Open',
        item.reason || null,
        createdBy || item.created_by || item.createdBy || null
    ]);

    const query = `
        INSERT INTO sipuro_db.po_batch_allocation_logs 
        (
            upload_log_id, allocation_id, po_detail_id, id_batch, action_type,
            old_allocated_qty, new_allocated_qty, old_status, new_status,
            reason, created_by
        ) 
        VALUES ?
    `;

    await connection.query(query, [values]);
};

/**
 * Log saat alokasi PO - Batch diperbarui / dibatalkan / force close / edit qty (UPDATE)
 */
exports.logAllocationUpdate = async (connection, updates, createdBy = null) => {
    const items = Array.isArray(updates) ? updates : [updates];
    if (items.length === 0) return;

    const values = items.map(item => [
        item.upload_log_id || item.uploadLogId || null,
        item.allocation_id || item.allocationId || item.id,
        item.po_detail_id || item.poDetailId,
        item.id_batch || item.idBatch || item.batchId,
        'UPDATE',
        Number(item.old_allocated_qty) || 0,
        Number(item.new_allocated_qty) || 0,
        item.old_status || item.oldStatus || null,
        item.new_status || item.newStatus || null,
        item.reason || null,
        createdBy || item.created_by || item.createdBy || null
    ]);

    const query = `
        INSERT INTO sipuro_db.po_batch_allocation_logs 
        (
            upload_log_id, allocation_id, po_detail_id, id_batch, action_type,
            old_allocated_qty, new_allocated_qty, old_status, new_status,
            reason, created_by
        ) 
        VALUES ?
    `;

    await connection.query(query, [values]);
};

/**
 * Fetch allocation logs history with pagination & user details
 */
exports.getAllocationLogs = async (db, allocationId, page = 1, limit = 10) => {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    // 1. Count total records
    const [[{ totalItems }]] = await db.query(`
        SELECT COUNT(*) AS totalItems
        FROM sipuro_db.po_batch_allocation_logs
        WHERE allocation_id = ?
    `, [Number(allocationId)]);

    // 2. Fetch paginated logs with creator name (LEFT JOIN user/employee)
    // Pastikan limitNum dan offset bertipe Number murni untuk prepared statement MySQL
    const [logs] = await db.query(`
        SELECT 
            log.id,
            log.upload_log_id,
            log.allocation_id,
            log.po_detail_id,
            log.id_batch,
            log.action_type,
            log.old_allocated_qty,
            log.new_allocated_qty,
            log.old_status,
            log.new_status,
            log.reason,
            log.created_by,
            log.created_at,
            COALESCE(emp.full_name, emp.employee_code, 'System') AS created_by_name
        FROM sipuro_db.po_batch_allocation_logs log
        LEFT JOIN sipuro_db.employees emp ON log.created_by = emp.id
        WHERE log.allocation_id = ?
        ORDER BY log.created_at DESC, log.id DESC
        LIMIT ? OFFSET ?
    `, [Number(allocationId), Number(limitNum), Number(offset)]);

    const totalPages = Math.ceil(totalItems / limitNum) || 1;

    return {
        logs,
        pagination: {
            currentPage: pageNum,
            totalPages,
            totalItems: Number(totalItems),
            limit: limitNum
        }
    };
};
