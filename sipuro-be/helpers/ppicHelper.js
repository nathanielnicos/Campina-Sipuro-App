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
        // 1. Cek apakah total kebutuhan kuantitas PO sudah teralokasi penuh
        const [allocRows] = await connection.query(
            `SELECT SUM(allocated_qty) AS total_allocated 
             FROM sipuro_db.po_batch_allocations 
             WHERE po_detail_id = ?`,
            [item.po_detail_id]
        );
        const totalAllocated = allocRows[0].total_allocated || 0;

        if (totalAllocated < item.base_qty) {
            isFullyAllocated = false;
        }

        // 2. Cek apakah masih ada alokasi PO yang berstatus 'Open'
        const [openAllocRows] = await connection.query(
            `SELECT COUNT(*) AS open_count 
             FROM sipuro_db.po_batch_allocations 
             WHERE po_detail_id = ? AND status = 'Open'`,
            [item.po_detail_id]
        );

        if (openAllocRows[0].open_count > 0) {
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
