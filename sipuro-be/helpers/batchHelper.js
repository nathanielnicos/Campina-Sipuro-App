const { sipuroDb: db } = require('../config/db');
const { logPOHeader } = require('./poLogHelper');

/**
 * Mengambil nilai toleransi PO (persentase / desimal) pasti dari database company_profile.
 * Jika data tidak ditemukan, akan meng-throw Error agar transaksi dibatalkan (rollbacked).
 * @param {Object} [dbOrConn] - Opsional, koneksi database/transaction.
 * @returns {Promise<number>} - Menghasilkan angka rasio toleransi (misal 90.00% -> 0.90)
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
    // 0. Ambil status PO saat ini sebagai acuan (old_status)
    const [[currentPO]] = await connection.query(
        `SELECT status FROM sipuro_db.po_headers WHERE po_header_id = ?`,
        [poHeaderId]
    );

    if (!currentPO) return;
    const oldStatus = currentPO.status;

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

    let targetStatus = null;

    // C. Jika pembuatan batch belum memenuhi total base_qty PO -> "Waiting Batch Assignment"
    if (!isFullyAssigned) {
        targetStatus = 'Waiting Batch Assignment';
    } else {
        // D. Jika Pembuatan Batch SUDAH LENGKAP (100%), Cek Status Pemenuhan Aktual (Open vs Close)
        const [openAllocations] = await connection.query(`
            SELECT pba.id
            FROM sipuro_db.po_batch_allocations pba
            JOIN sipuro_db.po_details pd ON pba.po_detail_id = pd.po_detail_id
            WHERE pd.po_header_id = ? AND pba.status = 'Open'
        `, [poHeaderId]);

        const isAllClosed = openAllocations.length === 0;
        targetStatus = isAllClosed ? 'Completed' : 'On Process';
    }

    // E. Eksekusi UPDATE & LOG hanya jika status benar-benar BERUBAH
    if (targetStatus && targetStatus !== oldStatus) {
        await connection.query(
            `UPDATE sipuro_db.po_headers SET status = ? WHERE po_header_id = ?`,
            [targetStatus, poHeaderId]
        );

        // Catat Log Otomatis Sistem
        await logPOHeader(connection, {
            poHeaderId,
            actionType: 'STATUS_AUTO_CHANGE',
            oldStatus: oldStatus,
            newStatus: targetStatus,
            actionBy: null, // null karena dipicu otomatis oleh sistem
            reason: `Sistem mengubah status dari '${oldStatus}' ke '${targetStatus}'`
        });
    }
}

module.exports = {
    getPOTolerance,
    refreshPOStatus
};
