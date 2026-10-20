const { sipuroDb: db } = require('../config/db');
const { logPOHeader } = require('./poLogHelper');

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

// Hanya header dengan status ini yang boleh diubah otomatis oleh refreshPOStatus
const AUTO_STATUS_HEADER_STATUSES = ['Approved', 'Production Completed'];

/**
 * Helper untuk menghitung & memperbarui status po_headers berbasis PO Lot Allocation.
 */
async function refreshPOStatus(connection, poHeaderId) {
    const [[currentPO]] = await connection.query(
        `SELECT status FROM po_headers WHERE po_header_id = ?`,
        [poHeaderId]
    );

    if (!currentPO) return;
    const oldStatus = currentPO.status;

    if (!AUTO_STATUS_HEADER_STATUSES.includes(oldStatus)) return;

    const [details] = await connection.query(
        `SELECT po_detail_id, base_qty, status
         FROM po_details
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
            // Membaca dari po_lot_allocations
            const [sums] = await connection.query(
                `SELECT
                    po_detail_id,
                    COALESCE(SUM(CASE WHEN status <> 'Canceled' THEN allocated_qty ELSE 0 END), 0) AS total_allocated_qty,
                    SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS open_count
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
const resolveBatchStatus = (statuses, currentStatus) => {
    if (statuses.every((s) => s === 'Canceled')) return 'Canceled';
    if (statuses.includes('Open')) return 'Open';
    if (statuses.includes('Force Closed')) return 'Force Closed';
    return 'Closed';
};

/**
 * Menyegarkan status Induk Batch (batches) berdasarkan alokasi lot di dalamnya
 */
async function refreshBatchStatus(connection, batchId) {
    const [[currentBatch]] = await connection.query(
        `SELECT status FROM batches WHERE id = ?`,
        [batchId]
    );

    if (!currentBatch) return;

    // Ambil status alokasi lot yang terhubung dengan batch ini
    const [allocations] = await connection.query(
        `SELECT pla.status 
         FROM batch_lots bl
         JOIN po_lot_allocations pla ON bl.lot_id = pla.lot_id
         WHERE bl.batch_id = ?`,
        [batchId]
    );

    if (allocations.length === 0) return;

    const targetStatus = resolveBatchStatus(allocations.map((a) => a.status), currentBatch.status);

    if (targetStatus !== currentBatch.status) {
        await connection.query(
            `UPDATE batches SET status = ? WHERE id = ?`,
            [targetStatus, batchId]
        );
    }
}

/**
 * Versi massal refreshBatchStatus (dioptimalkan untuk bulk update)
 */
async function refreshBatchStatuses(connection, batchIds = []) {
    const ids = [...new Set(batchIds.filter(Boolean))];
    if (ids.length === 0) return;

    const [batches] = await connection.query(
        `SELECT id, status FROM batches WHERE id IN (?)`,
        [ids]
    );

    const [allocations] = await connection.query(
        `SELECT bl.batch_id, pla.status 
         FROM batch_lots bl
         JOIN po_lot_allocations pla ON bl.lot_id = pla.lot_id
         WHERE bl.batch_id IN (?)`,
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
        const target = resolveBatchStatus(statuses, b.status);
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
 * Menyegarkan fulfilled_qty pada po_details dari alokasi po_lot_allocations
 */
async function refreshPODetailFulfilledQty(connection, poDetailId) {
    await connection.query(
        `UPDATE po_details d
         SET d.fulfilled_qty = (
             SELECT COALESCE(SUM(pla.allocated_qty), 0)
             FROM po_lot_allocations pla
             WHERE pla.po_detail_id = d.po_detail_id AND pla.status != 'Canceled'
         )
         WHERE d.po_detail_id = ?`,
        [poDetailId]
    );
}

/**
 * Update tanggal aktual produksi batch dari tabel log upload lot
 */
async function updateBatchProductionDates(connection, batchNumber, currentUserId) {
    const [[dates]] = await connection.query(`
        SELECT 
            MIN(actual_completed_datetime) AS min_completed,
            MAX(actual_completed_datetime) AS max_completed
        FROM production_lot_upload_details
        WHERE batch_number = ?
    `, [batchNumber]);

    if (dates && (dates.min_completed || dates.max_completed)) {
        await connection.query(`
            UPDATE batches 
            SET 
                actual_production_date = COALESCE(?, actual_production_date),
                actual_completed_date = COALESCE(?, actual_completed_date),
                updated_by = ?
            WHERE batch_number = ?
        `, [dates.min_completed, dates.max_completed, currentUserId, batchNumber]);
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
