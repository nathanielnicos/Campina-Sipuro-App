// AUTO-CLOSE BATCH THRESHOLD
const AUTO_CLOSE_THRESHOLD_PERCENT = 90;

async function refreshPOStatus(connection, poHeaderId) {
    const [details] = await connection.query(
        `SELECT po_detail_id, base_qty FROM sipuro_db.po_details WHERE po_header_id = ? AND deleted_at IS NULL`,
        [poHeaderId]
    );

    if (details.length === 0) return;

    let isFullyAllocated = true;
    let isAllAllocationsClosed = true;

    for (const item of details) {
        const [allocRows] = await connection.query(
            `SELECT SUM(allocated_qty) AS total_allocated 
             FROM sipuro_db.po_batch_allocations 
             WHERE po_detail_id = ? AND status = 'Active'`,
            [item.po_detail_id]
        );
        const totalAllocated = allocRows[0].total_allocated || 0;

        if (totalAllocated < item.base_qty) {
            isFullyAllocated = false;
        }

        const [batchStatusRows] = await connection.query(
            `SELECT b.status 
             FROM sipuro_db.po_batch_allocations pba
             JOIN sipuro_db.batches b ON pba.batch_id = b.batch_id
             WHERE pba.po_detail_id = ? AND pba.status = 'Active'`,
            [item.po_detail_id]
        );

        if (batchStatusRows.length === 0 || batchStatusRows.some(b => b.status !== 'Close')) {
            isAllAllocationsClosed = false;
        }
    }

    let newPOStatus = 'Waiting Batch Assignment';
    if (isFullyAllocated) {
        newPOStatus = isAllAllocationsClosed ? 'Completed' : 'On Process';
    }

    await connection.query(
        `UPDATE sipuro_db.po_headers SET status = ? WHERE po_header_id = ?`,
        [newPOStatus, poHeaderId]
    );
}

module.exports = { refreshPOStatus, AUTO_CLOSE_THRESHOLD_PERCENT };
