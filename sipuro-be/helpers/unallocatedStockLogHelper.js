/**
 * Helper terpusat untuk mencatat audit log mutasi unallocated_stocks
 */

/**
 * Catat log mutasi stok kelebihan produksi
 * 
 * @param {Object} connection - Connection/Pool MySQL transaction
 * @param {Object|Array} logsData - Objek tunggal atau Array dari objek log
 * @param {number|null} currentUserId - ID User yang melakukan aksi
 */
exports.logUnallocatedStock = async (connection, logsData, currentUserId = null) => {
    if (!logsData) return;

    const logsArray = Array.isArray(logsData) ? logsData : [logsData];
    if (logsArray.length === 0) return;

    const values = logsArray.map(log => [
        log.unallocated_stock_id || log.unallocatedStockId,
        log.target_allocation_id || log.targetAllocationId || null,
        log.action_type || log.actionType || 'REALLOCATE',
        log.qty_reallocated !== undefined ? log.qty_reallocated : (log.qtyReallocated || 0),
        log.qty_before !== undefined ? log.qty_before : (log.qtyBefore || 0),
        log.qty_after !== undefined ? log.qty_after : (log.qtyAfter || 0),
        log.created_by || currentUserId || null
    ]);

    const query = `
        INSERT INTO unallocated_stock_logs 
            (unallocated_stock_id, target_allocation_id, action_type, qty_reallocated, qty_before, qty_after, created_by)
        VALUES ?
    `;

    await connection.query(query, [values]);
};
