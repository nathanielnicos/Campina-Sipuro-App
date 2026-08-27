// AUTO-CLOSE BATCH THRESHOLD
const AUTO_CLOSE_THRESHOLD_PERCENT = 90;

/**
 * Helper untuk menghitung & memperbarui status po_headers secara presisi
 */
async function refreshPOStatus(connection, poHeaderId) {
    // A. Cek Pemenuhan Pembuatan Batch per SKU di PO
    const [qtyCheck] = await connection.query(`
        SELECT 
            pd.po_detail_id,
            pd.base_qty,
            COALESCE(SUM(pba.allocated_qty), 0) AS total_allocated_qty
        FROM sipuro_db.po_details pd
        LEFT JOIN sipuro_db.po_batch_allocations pba ON pd.po_detail_id = pba.po_detail_id
        WHERE pd.po_header_id = ? AND pd.deleted_at IS NULL
        GROUP BY pd.po_detail_id, pd.base_qty
    `, [poHeaderId]);

    if (!qtyCheck || qtyCheck.length === 0) return;

    // B. Evaluasi apakah SELURUH detail SKU pada PO sudah dibuatkan batch sesuai target base_qty
    let isFullyAssigned = true;

    for (const item of qtyCheck) {
        const targetQty = Number(item.base_qty);
        const allocatedQty = Number(item.total_allocated_qty);

        if (allocatedQty < targetQty) {
            isFullyAssigned = false;
            break;
        }
    }

    // C. Jika pembuatan batch belum memenuhi total base_qty PO -> "Waiting Batch Assignment"
    if (!isFullyAssigned) {
        await connection.query(
            `UPDATE sipuro_db.po_headers SET status = 'Waiting Batch Assignment' WHERE po_header_id = ?`,
            [poHeaderId]
        );
        return;
    }

    // D. Jika Pembuatan Batch SUDAH LENGKAP (100%), Cek Status Pemenuhan Aktual (Open vs Close)
    const [openAllocations] = await connection.query(`
        SELECT pba.id
        FROM sipuro_db.po_batch_allocations pba
        JOIN sipuro_db.po_details pd ON pba.po_detail_id = pd.po_detail_id
        WHERE pd.po_header_id = ? AND pba.status = 'Open'
    `, [poHeaderId]);

    const isAllClosed = openAllocations.length === 0;
    const finalStatus = isAllClosed ? 'Completed' : 'On Process';

    await connection.query(
        `UPDATE sipuro_db.po_headers SET status = ? WHERE po_header_id = ?`,
        [finalStatus, poHeaderId]
    );
}

module.exports = { refreshPOStatus, AUTO_CLOSE_THRESHOLD_PERCENT };
