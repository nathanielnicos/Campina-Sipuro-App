const { sipuroDb: db } = require('../config/db');
const { logPOHeader } = require('./poLogHelper');

/**
 * Mengambil nilai toleransi PO dari database (untuk kebutuhan Frontend)
 */
async function getPOTolerance(dbOrConn) {
    const client = dbOrConn || db;
    const [[profile]] = await client.query(
        'SELECT po_tolerance_percent FROM company_profile LIMIT 1'
    );

    if (!profile || profile.po_tolerance_percent === null || profile.po_tolerance_percent === undefined) {
        throw new Error('Setting po_tolerance_percent is not configured in company_profile.');
    }

    return parseFloat(profile.po_tolerance_percent) / 100;
}

// Hanya header dengan status ini yang boleh diubah otomatis oleh refreshPOStatus
const AUTO_STATUS_HEADER_STATUSES = ['Approved', 'Production Completed'];

/**
 * Helper untuk menghitung & memperbarui status po_headers.
 *
 * Aturan:
 *  1. Hanya header 'Approved' / 'Production Completed' yang diproses. Status lain tidak disentuh.
 *  2. Detail 'Deleted', 'Closed', 'Partially Closed', 'Canceled' (dan deleted_at terisi) diabaikan.
 *  3. Ada detail 'Close Requested' -> header tetap/kembali 'Approved'.
 *  4. Semua detail 'Active' harus terpenuhi (alokasi non-Canceled >= base_qty) untuk 'Production Completed'.
 *  5. Selama masih ada alokasi 'Open' pada detail 'Active' -> 'Approved'.
 *  6. Tanpa detail 'Active': 'Production Completed' jika ada minimal satu detail Closed/Partially Closed
 *     dan tidak ada Close Requested. Jika tidak ada keduanya, status tidak diubah.
 */
async function refreshPOStatus(connection, poHeaderId) {
    const [[currentPO]] = await connection.query(
        `SELECT status FROM sipuro_db.po_headers WHERE po_header_id = ?`,
        [poHeaderId]
    );

    if (!currentPO) return;
    const oldStatus = currentPO.status;

    if (!AUTO_STATUS_HEADER_STATUSES.includes(oldStatus)) return;

    const [details] = await connection.query(
        `SELECT po_detail_id, base_qty, status
         FROM sipuro_db.po_details
         WHERE po_header_id = ? AND deleted_at IS NULL`,
        [poHeaderId]
    );

    let targetStatus = null;

    if (details.some((d) => d.status === 'Close Requested')) {
        targetStatus = 'Approved';
    } else {
        const activeDetails = details.filter((d) => d.status === 'Active');

        if (activeDetails.length === 0) {
            const hasClosedDetail = details.some(
                (d) => d.status === 'Closed' || d.status === 'Partially Closed'
            );
            if (!hasClosedDetail) return;
            targetStatus = 'Production Completed';
        } else {
            const [sums] = await connection.query(
                `SELECT
                    po_detail_id,
                    COALESCE(SUM(CASE WHEN status <> 'Canceled' THEN allocated_qty ELSE 0 END), 0) AS total_allocated_qty,
                    SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS open_count
                 FROM sipuro_db.po_batch_allocations
                 WHERE po_detail_id IN (?)
                 GROUP BY po_detail_id`,
                [activeDetails.map((d) => d.po_detail_id)]
            );
            const sumByDetail = new Map(sums.map((s) => [s.po_detail_id, s]));

            let isComplete = true;
            for (const d of activeDetails) {
                const s = sumByDetail.get(d.po_detail_id);
                const allocated = s ? Number(s.total_allocated_qty) || 0 : 0;
                const openCount = s ? Number(s.open_count) || 0 : 0;
                if (allocated < (Number(d.base_qty) || 0) || openCount > 0) {
                    isComplete = false;
                    break;
                }
            }
            targetStatus = isComplete ? 'Production Completed' : 'Approved';
        }
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
            reason: `System automatically changed status from '${oldStatus}' to '${targetStatus}'`
        });
    }
}

// Aturan status batch dari kumpulan status alokasinya (dipakai versi tunggal dan massal)
const resolveBatchStatus = (statuses, currentStatus) => {
    if (statuses.every((s) => s === 'Canceled')) return 'Canceled';
    if (statuses.includes('Open')) return 'Open';
    if (statuses.includes('Force Closed')) return 'Force Closed';
    return 'Closed';
};

/**
 * Helper untuk menyegarkan status Induk Batch (batches) berdasarkan kombinasi status alokasi di dalamnya
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

    const targetStatus = resolveBatchStatus(allocations.map((a) => a.status), currentBatch.status);

    if (targetStatus !== currentBatch.status) {
        await connection.query(
            `UPDATE sipuro_db.batches SET status = ? WHERE id = ?`,
            [targetStatus, batchId]
        );
    }
}

/**
 * Versi massal dari refreshBatchStatus (aturan identik, jumlah query tetap kecil).
 * Dipakai commit upload agar cepat walau banyak batch.
 */
async function refreshBatchStatuses(connection, batchIds = []) {
    const ids = [...new Set(batchIds.filter(Boolean))];
    if (ids.length === 0) return;

    const [batches] = await connection.query(
        `SELECT id, status FROM sipuro_db.batches WHERE id IN (?)`,
        [ids]
    );
    const [allocations] = await connection.query(
        `SELECT id_batch, status FROM sipuro_db.po_batch_allocations WHERE id_batch IN (?)`,
        [ids]
    );

    const statusesByBatch = new Map();
    allocations.forEach((a) => {
        if (!statusesByBatch.has(a.id_batch)) statusesByBatch.set(a.id_batch, []);
        statusesByBatch.get(a.id_batch).push(a.status);
    });

    const idsByTarget = new Map();
    batches.forEach((b) => {
        const statuses = statusesByBatch.get(b.id);
        if (!statuses || statuses.length === 0) return;
        const target = resolveBatchStatus(statuses, b.status);
        if (target !== b.status) {
            if (!idsByTarget.has(target)) idsByTarget.set(target, []);
            idsByTarget.get(target).push(b.id);
        }
    });

    for (const [target, targetIds] of idsByTarget.entries()) {
        await connection.query(
            `UPDATE sipuro_db.batches SET status = ? WHERE id IN (?)`,
            [target, targetIds]
        );
    }
}

/**
 * Helper untuk menyegarkan total fulfilled_qty pada po_details dari alokasinya
 */
async function refreshPODetailFulfilledQty(connection, poDetailId) {
    await connection.query(
        `UPDATE po_details d
         SET d.fulfilled_qty = (
             SELECT COALESCE(SUM(pba.allocated_qty), 0)
             FROM po_batch_allocations pba
             WHERE pba.po_detail_id = d.po_detail_id AND pba.status != 'Canceled'
         )
         WHERE d.po_detail_id = ?`,
        [poDetailId]
    );
}

/**
 * Helper untuk menyinkronkan tanggal aktual produksi ke tabel batches dari detail upload
 */
async function updateBatchProductionDates(connection, batchNumber, currentUserId) {
    const [[dates]] = await connection.query(`
        SELECT 
            MIN(actual_start_datetime) AS min_start,
            MAX(actual_completed_datetime) AS max_completed
        FROM production_upload_details
        WHERE batch_number = ?
    `, [batchNumber]);

    if (dates && (dates.min_start || dates.max_completed)) {
        await connection.query(`
            UPDATE batches 
            SET 
                actual_production_date = COALESCE(?, actual_production_date),
                actual_completed_date = COALESCE(?, actual_completed_date),
                updated_by = ?
            WHERE batch_number = ?
        `, [dates.min_start, dates.max_completed, currentUserId, batchNumber]);
    }
}

module.exports = {
    getPOTolerance,
    refreshPOStatus,
    refreshBatchStatus,
    refreshBatchStatuses,
    refreshPODetailFulfilledQty,
    updateBatchProductionDates
};
