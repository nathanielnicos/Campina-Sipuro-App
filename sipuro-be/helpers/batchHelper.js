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

/**
 * Helper untuk menghitung & memperbarui status po_headers secara presisi (Murni 100%)
 */
async function refreshPOStatus(connection, poHeaderId) {
    const [[currentPO]] = await connection.query(
        `SELECT status FROM sipuro_db.po_headers WHERE po_header_id = ?`,
        [poHeaderId]
    );

    if (!currentPO) return;
    const oldStatus = currentPO.status;

    // A. Cek Ketercukupan Kuantitas Alokasi vs Base Qty Per Detail PO
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
        const baseQtyNum = Number(item.base_qty) || 0;
        const allocatedQtyNum = Number(item.total_allocated_qty) || 0;

        // Harus memenuhi atau melebihi baseQty (100%)
        if (allocatedQtyNum < baseQtyNum) {
            isFullyAssigned = false;
            break;
        }
    }

    let targetStatus = null;

    if (!isFullyAssigned) {
        targetStatus = 'Approved';
    } else {
        // Jika ketercukupan kuantitas sudah 100%, cek apakah masih ada alokasi aktif berstatus 'Open'
        const [openAllocations] = await connection.query(`
            SELECT pba.id
            FROM sipuro_db.po_batch_allocations pba
            JOIN sipuro_db.po_details pd ON pba.po_detail_id = pd.po_detail_id
            WHERE pd.po_header_id = ? AND pba.status = 'Open'
        `, [poHeaderId]);

        targetStatus = openAllocations.length === 0 ? 'Production Completed' : 'Approved';
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

    const statuses = allocations.map(a => a.status);
    let targetStatus = currentBatch.status;

    if (statuses.every(s => s === 'Canceled')) {
        targetStatus = 'Canceled';
    } else if (statuses.includes('Open')) {
        targetStatus = 'Open';
    } else if (statuses.includes('Force Closed')) {
        targetStatus = 'Force Closed';
    } else {
        targetStatus = 'Closed';
    }

    if (targetStatus !== currentBatch.status) {
        await connection.query(
            `UPDATE sipuro_db.batches SET status = ? WHERE id = ?`,
            [targetStatus, batchId]
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
    refreshPODetailFulfilledQty,
    updateBatchProductionDates
};
