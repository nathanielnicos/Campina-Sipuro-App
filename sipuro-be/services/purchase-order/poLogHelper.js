/**
 * Helper untuk mencatat Audit Trail / Log PO
 */

/**
 * Mencatat Log Header PO
 */
const logPOHeader = async (connection, {
    poHeaderId,
    actionType,
    oldStatus = null,
    newStatus = null,
    actionBy = null,
    reason = null
}) => {
    const [result] = await connection.query(
        `INSERT INTO po_header_logs (
            po_header_id, action_type, old_status, new_status, action_by, reason
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [poHeaderId, actionType, oldStatus, newStatus, actionBy, reason]
    );
    return result.insertId; // Mengembalikan po_header_log_id
};

/**
 * Mencatat Log Detail Item PO (Before vs After)
 */
const logPODetails = async (connection, poHeaderLogId, detailLogs = []) => {
    if (!detailLogs || detailLogs.length === 0) return;

    const values = detailLogs.map(item => [
        poHeaderLogId,
        item.po_detail_id,
        item.id_product,
        item.old_qty || 0,
        item.new_qty || 0,
        item.old_base_qty || 0,
        item.new_base_qty || 0,
        item.old_total_price || 0.00,
        item.new_total_price || 0.00,
        item.old_status || null,
        item.new_status || null
    ]);

    await connection.query(
        `INSERT INTO po_detail_logs (
            po_header_log_id, po_detail_id, id_product,
            old_qty, new_qty, old_base_qty, new_base_qty,
            old_total_price, new_total_price,
            old_status, new_status
        ) VALUES ?`,
        [values]
    );
};

module.exports = {
    logPOHeader,
    logPODetails
};
