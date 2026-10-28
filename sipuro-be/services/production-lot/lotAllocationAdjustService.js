'use strict';

/**
 * Perubahan manual pada satu alokasi (item PO, lot, batch): ubah qty dan Force Close.
 * Semua fungsi berjalan di dalam transaksi ber-lock (lotLockedTransaction); alasan wajib dan dicatat di riwayat.
 *
 * Urutan penguncian baris sama dengan commit upload: po_details dahulu, baru po_lot_allocations.
 */

const { BusinessError } = require('../../helpers/businessError');
const { parseIdParam } = require('../../helpers/queryParams');
const { NOT_DELETED_SQL } = require('../../helpers/po/openItemRules');
const { logAllocationUpdate } = require('./lotAllocationLog');
const { getLotBatchCapacity } = require('./lotProductionTotals');
const {
    refreshPOStatus,
    refreshBatchStatuses,
    recalculateFulfilledQty,
    syncAllocationStatuses
} = require('./lotStatusService');
const {
    ALLOCATION_STATUS,
    PO_DETAIL_STATUS,
    ELIGIBLE_HEADER_STATUSES,
    ELIGIBLE_ALLOCATION_STATUSES
} = require('./lotAllocationRules');

const REASON_MAX_LENGTH = 50;
const MAX_QTY = 2147483647; // batas kolom INT
const SYNC_REASON_EDIT = 'Auto status sync after quantity edit';

const formatThousand = (value) => Number(value).toLocaleString('id-ID');

// ---------- Pembacaan input (murni) ----------

const parseAllocationId = (raw) => parseIdParam(raw, 'Allocation ID');

const parseReason = (raw) => {
    const reason = typeof raw === 'string' ? raw.trim() : '';
    if (!reason) {
        throw new BusinessError('Reason is required.', 400);
    }
    if (reason.length > REASON_MAX_LENGTH) {
        throw new BusinessError(`Reason must be at most ${REASON_MAX_LENGTH} characters.`, 400);
    }
    return reason;
};

const parseNewQty = (raw) => {
    const isNumber = typeof raw === 'number';
    const isDigits = typeof raw === 'string' && /^\d+$/.test(raw.trim());
    const value = isNumber ? raw : (isDigits ? Number(raw.trim()) : NaN);

    if (!Number.isInteger(value) || value < 0 || value > MAX_QTY) {
        throw new BusinessError('New allocated quantity must be a whole number greater than or equal to 0.', 400);
    }
    return value;
};

// ---------- Pemuatan dan validasi keadaan ----------

/**
 * Mengunci item PO lalu semua alokasinya, dan memastikan perubahan boleh dilakukan.
 */
const loadLockedAllocation = async (connection, allocationId) => {
    const [[found]] = await connection.query(
        'SELECT id, po_detail_id FROM po_lot_allocations WHERE id = ?',
        [allocationId]
    );
    if (!found) {
        throw new BusinessError('Allocation record not found.', 404);
    }

    // 1. Kunci item PO (urutan yang sama dengan commit upload)
    const [[detail]] = await connection.query(
        `SELECT d.po_detail_id, d.po_header_id, d.id_product, d.base_qty, d.status
         FROM po_details d
         WHERE d.po_detail_id = ? AND ${NOT_DELETED_SQL}
         FOR UPDATE`,
        [found.po_detail_id]
    );
    if (!detail) {
        throw new BusinessError('PO item not found.', 404);
    }

    // 2. Kunci seluruh alokasi item PO ini
    const [siblings] = await connection.query(
        `SELECT id, po_detail_id, lot_id, id_batch, allocated_qty, status
         FROM po_lot_allocations
         WHERE po_detail_id = ?
         ORDER BY id
         FOR UPDATE`,
        [detail.po_detail_id]
    );
    const allocation = siblings.find((s) => s.id === allocationId);
    if (!allocation) {
        throw new BusinessError('Allocation record not found.', 404);
    }

    const [[header]] = await connection.query(
        'SELECT status FROM po_headers WHERE po_header_id = ?',
        [detail.po_header_id]
    );

    if (detail.status === PO_DETAIL_STATUS.CLOSE_REQUESTED) {
        throw new BusinessError('This PO item has a pending close request. Please complete the approval process first.', 409);
    }
    if (detail.status !== PO_DETAIL_STATUS.ACTIVE) {
        throw new BusinessError('This PO item is not active, so its allocation cannot be changed.', 409);
    }
    if (!header || !ELIGIBLE_HEADER_STATUSES.includes(header.status)) {
        throw new BusinessError('This PO is not in a status that allows allocation changes.', 409);
    }
    if (!ELIGIBLE_ALLOCATION_STATUSES.includes(allocation.status)) {
        throw new BusinessError(`Allocation is ${allocation.status} and cannot be changed.`, 409);
    }

    return { detail, allocation, siblings };
};

const sumAllocated = (allocations, excludeId = null) => allocations
    .filter((a) => a.id !== excludeId && a.status !== ALLOCATION_STATUS.CANCELED)
    .reduce((sum, a) => sum + (Number(a.allocated_qty) || 0), 0);

// ---------- Aksi ----------

/**
 * Ubah qty alokasi (tambah atau kurang).
 * Aturan: total item PO <= qty PO; total (lot, batch) <= produksi bersih; alasan wajib (dicatat).
 */
const adjustAllocationQty = async (connection, { allocationId, newQty, reason, userId }) => {
    const { detail, allocation, siblings } = await loadLockedAllocation(connection, allocationId);

    const oldQty = Number(allocation.allocated_qty) || 0;
    if (newQty === oldQty) {
        throw new BusinessError('The new quantity is the same as the current quantity.', 400);
    }

    const baseQty = Number(detail.base_qty) || 0;
    const totalOthers = sumAllocated(siblings, allocation.id);
    if (totalOthers + newQty > baseQty) {
        throw new BusinessError(
            `Total allocated quantity cannot exceed PO quantity (${formatThousand(baseQty)}). Maximum allowed for this allocation is ${formatThousand(Math.max(0, baseQty - totalOthers))}.`,
            400
        );
    }

    const capacity = await getLotBatchCapacity(connection, {
        lotId: allocation.lot_id,
        batchId: allocation.id_batch,
        productId: detail.id_product,
        excludeAllocationId: allocation.id
    });
    if (newQty > capacity.available) {
        throw new BusinessError(
            `Quantity exceeds the produced quantity of this lot and batch (${formatThousand(capacity.netProduced)} produced, ${formatThousand(capacity.otherAllocated)} allocated to other POs). Maximum allowed for this allocation is ${formatThousand(capacity.available)}.`,
            400
        );
    }

    const targetStatus = totalOthers + newQty >= baseQty ? ALLOCATION_STATUS.CLOSED : ALLOCATION_STATUS.OPEN;

    await connection.query(
        'UPDATE po_lot_allocations SET allocated_qty = ?, status = ?, updated_by = ? WHERE id = ?',
        [newQty, targetStatus, userId, allocation.id]
    );

    await logAllocationUpdate(connection, [{
        allocation_id: allocation.id,
        po_detail_id: detail.po_detail_id,
        lot_id: allocation.lot_id,
        id_batch: allocation.id_batch,
        old_allocated_qty: oldQty,
        new_allocated_qty: newQty,
        old_status: allocation.status,
        new_status: targetStatus,
        reason,
        created_by: userId
    }], userId);

    // Alokasi lain (lot/batch lain) pada item PO yang sama mengikuti status target
    const syncedBatchIds = await syncAllocationStatuses(connection, {
        targetStatusByDetail: new Map([[detail.po_detail_id, targetStatus]]),
        userId,
        reason: SYNC_REASON_EDIT
    });

    await recalculateFulfilledQty(connection, [detail.po_detail_id]);
    await refreshBatchStatuses(connection, [allocation.id_batch, ...syncedBatchIds]);
    await refreshPOStatus(connection, detail.po_header_id);

    return { allocationId: allocation.id, oldAllocatedQty: oldQty, newAllocatedQty: newQty, status: targetStatus };
};

/**
 * Force Close: hanya jika total alokasi item PO masih di bawah qty PO.
 */
const forceCloseAllocation = async (connection, { allocationId, reason, userId }) => {
    const { detail, allocation, siblings } = await loadLockedAllocation(connection, allocationId);

    const baseQty = Number(detail.base_qty) || 0;
    if (sumAllocated(siblings) >= baseQty) {
        throw new BusinessError(
            'Allocation is already fully fulfilled (>= 100%). It is automatically set to Closed status and cannot be Force Closed.',
            400
        );
    }

    await connection.query(
        'UPDATE po_lot_allocations SET status = ?, updated_by = ? WHERE id = ?',
        [ALLOCATION_STATUS.FORCE_CLOSED, userId, allocation.id]
    );

    await logAllocationUpdate(connection, [{
        allocation_id: allocation.id,
        po_detail_id: detail.po_detail_id,
        lot_id: allocation.lot_id,
        id_batch: allocation.id_batch,
        old_allocated_qty: Number(allocation.allocated_qty) || 0,
        new_allocated_qty: Number(allocation.allocated_qty) || 0,
        old_status: allocation.status,
        new_status: ALLOCATION_STATUS.FORCE_CLOSED,
        reason,
        created_by: userId
    }], userId);

    await refreshBatchStatuses(connection, [allocation.id_batch]);
    await refreshPOStatus(connection, detail.po_header_id);

    return { allocationId: allocation.id, status: ALLOCATION_STATUS.FORCE_CLOSED };
};

module.exports = {
    REASON_MAX_LENGTH,
    MAX_QTY,
    formatThousand,
    parseAllocationId,
    parseReason,
    parseNewQty,
    adjustAllocationQty,
    forceCloseAllocation
};
