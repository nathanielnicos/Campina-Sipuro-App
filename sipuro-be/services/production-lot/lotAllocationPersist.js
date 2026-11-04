'use strict';

/**
 * Menyimpan perubahan alokasi (item PO, lot, batch) ke database, lalu menyelaraskan status.
 * Dipakai bersama oleh commit upload lot dan penyusunan ulang alokasi (rebalance), di dalam transaksi ber-lock.
 * Satu-satunya tempat yang menulis po_lot_allocations dari proses massal:
 *   upsert -> riwayat -> fulfilled_qty -> sinkron status alokasi -> status batch dan header PO.
 *
 * Bentuk `items` (Map kunci allocationKey -> item):
 *   { poDetailId, lotId, batchId, addedQty, rowStatus, transTypes: [], steps?: [{ delta, transType }] }
 *   addedQty = jumlah seluruh perubahan. `steps` (opsional, hanya untuk alokasi yang sudah ada) memecah perubahan
 *   itu menjadi beberapa baris riwayat berurutan, mis. pembatalan edit manual lalu penggeseran.
 */

const { BusinessError } = require('../../helpers/businessError');
const {
    refreshPOStatus,
    refreshBatchStatuses,
    recalculateFulfilledQty,
    syncAllocationStatuses
} = require('./lotStatusService');
const { logAllocationInsert, logAllocationUpdate } = require('./lotAllocationLog');
const { ALLOCATION_STATUS, ELIGIBLE_ALLOCATION_STATUSES, allocationKey } = require('./lotAllocationRules');

const persistAllocationItems = async (connection, {
    items,
    userId,
    uploadLogId = null,
    reason,
    syncReason,
    problems = [],
    extraBatchIds = [],
    problemsMessage = 'The allocation would exceed or go below the PO quantity limits. Please upload the file again to refresh the preview.'
}) => {
    const lotIds = [...new Set([...items.values()].map((i) => i.lotId))];
    const [existingAllocRows] = await connection.query(
        'SELECT id, po_detail_id, lot_id, id_batch, allocated_qty, status FROM po_lot_allocations WHERE lot_id IN (?) FOR UPDATE',
        [lotIds.length > 0 ? lotIds : [0]]
    );
    const existingByPair = new Map(existingAllocRows.map((a) => [allocationKey(a.po_detail_id, a.lot_id, a.id_batch), a]));

    const upsertValues = [];
    const insertLogs = [];
    const updateLogs = [];

    items.forEach((item, key) => {
        const existing = existingByPair.get(key);
        const oldQty = existing ? Number(existing.allocated_qty) || 0 : 0;
        const newQty = oldQty + item.addedQty;

        if (newQty < 0) {
            problems.push(`Allocation for PO detail ${item.poDetailId}, lot ID ${item.lotId}, batch ID ${item.batchId} would become negative.`);
            return;
        }
        if (existing && !ELIGIBLE_ALLOCATION_STATUSES.includes(existing.status)) {
            problems.push(`Allocation for PO detail ${item.poDetailId}, lot ID ${item.lotId}, batch ID ${item.batchId} is ${existing.status} and cannot be changed.`);
            return;
        }

        upsertValues.push([item.poDetailId, item.lotId, item.batchId, newQty, item.rowStatus, userId, userId]);

        if (existing) {
            const steps = item.steps && item.steps.length > 0
                ? item.steps
                : [{ delta: item.addedQty, transType: item.transTypes.join(', ') || null }];
            let running = oldQty;
            steps.forEach((step, index) => {
                const isLast = index === steps.length - 1;
                updateLogs.push({
                    upload_log_id: uploadLogId,
                    allocation_id: existing.id,
                    po_detail_id: item.poDetailId,
                    lot_id: item.lotId,
                    id_batch: item.batchId,
                    old_allocated_qty: running,
                    new_allocated_qty: running + step.delta,
                    old_status: existing.status,
                    new_status: isLast ? item.rowStatus : existing.status,
                    reason,
                    trans_type: step.transType || null,
                    created_by: userId
                });
                running += step.delta;
            });
        } else {
            insertLogs.push({
                upload_log_id: uploadLogId,
                po_detail_id: item.poDetailId,
                lot_id: item.lotId,
                id_batch: item.batchId,
                allocated_qty: newQty,
                status: item.rowStatus,
                reason,
                trans_type: item.transTypes.join(', ') || null,
                created_by: userId
            });
        }
    });

    if (problems.length > 0) {
        throw new BusinessError('Allocation validation failed.', 422, { problems });
    }

    if (upsertValues.length > 0) {
        await connection.query(
            `INSERT INTO po_lot_allocations (po_detail_id, lot_id, id_batch, allocated_qty, status, created_by, updated_by)
             VALUES ?
             ON DUPLICATE KEY UPDATE
                allocated_qty = VALUES(allocated_qty),
                status = VALUES(status),
                updated_by = VALUES(updated_by)`,
            [upsertValues]
        );
    }

    // Catat Log Alokasi
    if (insertLogs.length > 0) {
        const triples = insertLogs.map((l) => [l.po_detail_id, l.lot_id, l.id_batch]);
        const [createdAllocs] = await connection.query(
            'SELECT id, po_detail_id, lot_id, id_batch FROM po_lot_allocations WHERE (po_detail_id, lot_id, id_batch) IN (?)',
            [triples]
        );
        const idByKey = new Map(createdAllocs.map((a) => [allocationKey(a.po_detail_id, a.lot_id, a.id_batch), a.id]));
        insertLogs.forEach((l) => {
            l.allocation_id = idByKey.get(allocationKey(l.po_detail_id, l.lot_id, l.id_batch));
        });
        await logAllocationInsert(connection, insertLogs, userId);
    }
    if (updateLogs.length > 0) {
        await logAllocationUpdate(connection, updateLogs, userId);
    }

    // Hitung Ulang fulfilled_qty pada `po_details` dari `po_lot_allocations`
    const poDetailIds = [...new Set([...items.values()].map((i) => i.poDetailId))];
    await recalculateFulfilledQty(connection, poDetailIds);

    const [poDetailRows] = await connection.query(
        'SELECT po_detail_id, po_header_id, base_qty, fulfilled_qty FROM po_details WHERE po_detail_id IN (?)',
        [poDetailIds.length > 0 ? poDetailIds : [0]]
    );

    const poHeaderIds = new Set();
    const targetStatusByDetail = new Map();
    poDetailRows.forEach((pd) => {
        const base = Number(pd.base_qty) || 0;
        const fulfilled = Number(pd.fulfilled_qty) || 0;
        if (fulfilled > base || fulfilled < 0) {
            problems.push(`PO detail ${pd.po_detail_id} would have fulfilled quantity ${fulfilled} against PO quantity ${base}.`);
        }
        if (pd.po_header_id) poHeaderIds.add(pd.po_header_id);
        targetStatusByDetail.set(pd.po_detail_id, fulfilled >= base ? ALLOCATION_STATUS.CLOSED : ALLOCATION_STATUS.OPEN);
    });

    if (problems.length > 0) {
        throw new BusinessError(problemsMessage, 409, { problems });
    }

    // Sinkronisasi status dua arah untuk seluruh alokasi (lot, batch) pada item PO yang sama
    const syncedBatchIds = await syncAllocationStatuses(connection, {
        targetStatusByDetail,
        userId,
        uploadLogId,
        reason: syncReason
    });

    // Refresh status Batch & Header PO: batch dari perubahan ini DAN dari alokasi yang ikut tersinkronisasi
    const allBatchIdsToRefresh = new Set([
        ...extraBatchIds,
        ...[...items.values()].map((i) => i.batchId),
        ...syncedBatchIds
    ]);
    if (allBatchIdsToRefresh.size > 0) {
        await refreshBatchStatuses(connection, [...allBatchIdsToRefresh]);
    }
    for (const poHeaderId of poHeaderIds) {
        await refreshPOStatus(connection, poHeaderId);
    }

    return { allocationCount: upsertValues.length };
};

module.exports = { persistAllocationItems };
