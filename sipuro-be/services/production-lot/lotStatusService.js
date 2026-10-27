const { sipuroDb: db } = require('../../config/db');
const { logPOHeader } = require('../../helpers/poLogHelper');
const {
    ALLOCATION_STATUS,
    PO_DETAIL_STATUS,
    ELIGIBLE_HEADER_STATUSES,
    allocatedQtySql
} = require('./lotAllocationRules');

/**
 * Layanan status modul Production Lot: status header PO, status batch, qty terpenuhi (fulfilled_qty),
 * dan tanggal selesai batch. Semua fungsi menerima koneksi yang sedang berada di dalam transaksi.
 */

/**
 * Mengambil nilai toleransi PO dari database
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

/**
 * Helper untuk menghitung & memperbarui status po_headers berbasis PO Lot Allocation.
 * Hanya header dengan status di ELIGIBLE_HEADER_STATUSES yang boleh diubah otomatis.
 */
async function refreshPOStatus(connection, poHeaderId) {
    const [[currentPO]] = await connection.query(
        `SELECT status FROM po_headers WHERE po_header_id = ?`,
        [poHeaderId]
    );

    if (!currentPO) return;
    const oldStatus = currentPO.status;

    if (!ELIGIBLE_HEADER_STATUSES.includes(oldStatus)) return;

    const [details] = await connection.query(
        `SELECT po_detail_id, base_qty, status
         FROM po_details
         WHERE po_header_id = ? AND deleted_at IS NULL`,
        [poHeaderId]
    );

    let targetStatus = null;

    if (details.some((d) => d.status === PO_DETAIL_STATUS.CLOSE_REQUESTED)) {
        targetStatus = 'Approved';
    } else {
        const activeDetails = details.filter((d) => d.status === PO_DETAIL_STATUS.ACTIVE);

        if (activeDetails.length === 0) {
            const hasClosedDetail = details.some(
                (d) => d.status === 'Closed' || d.status === 'Partially Closed'
            );
            if (!hasClosedDetail) return;
            targetStatus = 'Production Completed';
        } else {
            // Membaca dari po_lot_allocations
            const [sums] = await connection.query(
                `SELECT
                    po_detail_id,
                    COALESCE(SUM(CASE WHEN status <> '${ALLOCATION_STATUS.CANCELED}' THEN allocated_qty ELSE 0 END), 0) AS total_allocated_qty,
                    SUM(CASE WHEN status = '${ALLOCATION_STATUS.OPEN}' THEN 1 ELSE 0 END) AS open_count
                 FROM po_lot_allocations
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
            `UPDATE po_headers SET status = ? WHERE po_header_id = ?`,
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

// Aturan penentuan status batch dari status alokasi lot di dalamnya
const resolveBatchStatus = (statuses) => {
    if (statuses.every((s) => s === ALLOCATION_STATUS.CANCELED)) return ALLOCATION_STATUS.CANCELED;
    if (statuses.includes(ALLOCATION_STATUS.OPEN)) return ALLOCATION_STATUS.OPEN;
    if (statuses.includes(ALLOCATION_STATUS.FORCE_CLOSED)) return ALLOCATION_STATUS.FORCE_CLOSED;
    return ALLOCATION_STATUS.CLOSED;
};

/**
 * Menyegarkan status Induk Batch (batches) dari alokasi yang menunjuk batch itu (po_lot_allocations.id_batch).
 * Satu fungsi untuk satu atau banyak batch (jumlah query tetap kecil).
 */
async function refreshBatchStatuses(connection, batchIds = []) {
    const ids = [...new Set(batchIds.filter(Boolean))];
    if (ids.length === 0) return;

    const [batches] = await connection.query(
        `SELECT id, status FROM batches WHERE id IN (?)`,
        [ids]
    );

    const [allocations] = await connection.query(
        `SELECT id_batch AS batch_id, status
         FROM po_lot_allocations
         WHERE id_batch IN (?)`,
        [ids]
    );

    const statusesByBatch = new Map();
    allocations.forEach((a) => {
        if (!statusesByBatch.has(a.batch_id)) statusesByBatch.set(a.batch_id, []);
        statusesByBatch.get(a.batch_id).push(a.status);
    });

    const idsByTarget = new Map();
    batches.forEach((b) => {
        const statuses = statusesByBatch.get(b.id);
        if (!statuses || statuses.length === 0) return;
        const target = resolveBatchStatus(statuses);
        if (target !== b.status) {
            if (!idsByTarget.has(target)) idsByTarget.set(target, []);
            idsByTarget.get(target).push(b.id);
        }
    });

    for (const [target, targetIds] of idsByTarget.entries()) {
        await connection.query(
            `UPDATE batches SET status = ? WHERE id IN (?)`,
            [target, targetIds]
        );
    }
}

/**
 * Menyegarkan fulfilled_qty pada po_details dari alokasi po_lot_allocations.
 * Satu-satunya penulis fulfilled_qty untuk alur lot; rumusnya di lotAllocationRules.allocatedQtySql.
 */
async function recalculateFulfilledQty(connection, poDetailIds = []) {
    const ids = [...new Set(poDetailIds.filter(Boolean))];
    if (ids.length === 0) return;

    await connection.query(
        `UPDATE po_details d
         SET d.fulfilled_qty = ${allocatedQtySql('d.po_detail_id')}
         WHERE d.po_detail_id IN (?)`,
        [ids]
    );
}

/**
 * Tanggal selesai batch = MAX actual_completed_datetime dari baris upload batch itu sendiri
 * (bukan dari tanggal lot, agar lot yang dipakai beberapa batch tidak membocorkan tanggalnya).
 * Batch tidak punya tanggal mulai karena file lot tidak memuatnya.
 * COLLATE pada join: kolom batch_number di dua tabel memakai collation berbeda.
 */
async function syncBatchCompletedDates(connection, batchNumbers = [], updatedBy = null) {
    const numbers = [...new Set(batchNumbers.filter(Boolean))];
    if (numbers.length === 0) return;

    await connection.query(
        `UPDATE batches b
         JOIN (
            SELECT batch_number, MAX(actual_completed_datetime) AS max_completed
            FROM production_lot_upload_details
            WHERE batch_number IN (?)
            GROUP BY batch_number
         ) d ON d.batch_number COLLATE utf8mb4_unicode_ci = b.batch_number
         SET b.actual_completed_date = COALESCE(d.max_completed, b.actual_completed_date),
             b.updated_by = ?`,
        [numbers, updatedBy]
    );
}

module.exports = {
    getPOTolerance,
    refreshPOStatus,
    resolveBatchStatus,
    refreshBatchStatuses,
    recalculateFulfilledQty,
    syncBatchCompletedDates
};
