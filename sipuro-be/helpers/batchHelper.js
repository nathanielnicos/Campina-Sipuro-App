const { sipuroDb: db } = require('../config/db');
const { logPOHeader } = require('./poLogHelper');

/**
 * Mengambil nilai toleransi PO
 */
async function getPOTolerance(dbOrConn) {
    const client = dbOrConn || db;
    const [[profile]] = await client.query(
        'SELECT po_tolerance_percent FROM company_profile LIMIT 1'
    );

    if (!profile || profile.po_tolerance_percent === null || profile.po_tolerance_percent === undefined) {
        throw new Error('Pengaturan po_tolerance_percent belum dikonfigurasi pada company_profile.');
    }

    return parseFloat(profile.po_tolerance_percent) / 100;
}

/**
 * Helper untuk menghitung & memperbarui status po_headers secara presisi
 */
async function refreshPOStatus(connection, poHeaderId) {
    const [[currentPO]] = await connection.query(
        `SELECT status FROM sipuro_db.po_headers WHERE po_header_id = ?`,
        [poHeaderId]
    );

    if (!currentPO) return;
    const oldStatus = currentPO.status;

    // A. Cek Pemenuhan Pembuatan Batch per SKU di PO (Abaikan alokasi Canceled)
    const [qtyCheck] = await connection.query(`
        SELECT 
            pd.po_detail_id,
            pd.base_qty,
            COALESCE(SUM(CASE WHEN pba.status != 'Canceled' THEN pba.allocated_qty ELSE 0 END), 0) AS total_allocated_qty
        FROM sipuro_db.po_details pd
        LEFT JOIN sipuro_db.po_batch_allocations pba ON pd.po_detail_id = pba.po_detail_id
        WHERE pd.po_header_id = ? AND pd.deleted_at IS NULL
        GROUP BY pd.po_detail_id, pd.base_qty
    `, [poHeaderId]);

    if (!qtyCheck || qtyCheck.length === 0) return;

    let isFullyAssigned = true;
    for (const item of qtyCheck) {
        if (Number(item.total_allocated_qty) < Number(item.base_qty)) {
            isFullyAssigned = false;
            break;
        }
    }

    let targetStatus = null;

    if (!isFullyAssigned) {
        targetStatus = 'Waiting for Batch Assignment';
    } else {
        // Cek alokasi yang masih bernilai 'Open'
        const [openAllocations] = await connection.query(`
            SELECT pba.id
            FROM sipuro_db.po_batch_allocations pba
            JOIN sipuro_db.po_details pd ON pba.po_detail_id = pd.po_detail_id
            WHERE pd.po_header_id = ? AND pba.status = 'Open'
        `, [poHeaderId]);

        // PO Selesai jika tidak ada lagi alokasi berstatus 'Open'
        targetStatus = openAllocations.length === 0 ? 'Completed' : 'In Progress';
    }

    if (targetStatus && targetStatus !== oldStatus) {
        await connection.query(
            `UPDATE sipuro_db.po_headers SET status = ? WHERE po_header_id = ?`,
            [targetStatus, poHeaderId]
        );

        await logPOHeader(connection, {
            poHeaderId,
            actionType: 'STATUS_AUTO_CHANGE',
            oldStatus,
            newStatus: targetStatus,
            actionBy: null,
            reason: `Sistem mengubah status dari '${oldStatus}' ke '${targetStatus}'`
        });
    }
}

/**
 * Helper baru untuk menyegarkan status Induk Batch berdasarkan status alokasi di dalamnya
 */
async function refreshBatchStatus(connection, batchId) {
    const [[currentBatch]] = await connection.query(
        `SELECT status FROM sipuro_db.batches WHERE id = ?`,
        [batchId]
    );

    if (!currentBatch) return;

    const [allocations] = await connection.query(
        `SELECT status FROM sipuro_db.po_batch_allocations WHERE id_batch = ?`,
        [batchId]
    );

    if (allocations.length === 0) return;

    const statuses = allocations.map(a => a.status);
    let targetStatus = currentBatch.status;

    // 1. Jika SEMUA alokasi 'Canceled' -> Batch Canceled
    if (statuses.every(s => s === 'Canceled')) {
        targetStatus = 'Canceled';
    }
    // 2. Jika MASIH ADA alokasi yang 'Open' -> Batch tetap Open
    else if (statuses.includes('Open')) {
        targetStatus = 'Open';
    }
    // 3. Jika TIDAK ADA 'Open', tapi ADA minimal 1 'Force Closed' -> Batch Force Closed
    else if (statuses.includes('Force Closed')) {
        targetStatus = 'Force Closed';
    }
    // 4. Jika SEMUA alokasi selain Canceled sudah 'Closed' -> Batch Closed
    else {
        targetStatus = 'Closed';
    }

    if (targetStatus !== currentBatch.status) {
        await connection.query(
            `UPDATE sipuro_db.batches SET status = ? WHERE id = ?`,
            [targetStatus, batchId]
        );
    }
}

module.exports = {
    getPOTolerance,
    refreshPOStatus,
    refreshBatchStatus
};
