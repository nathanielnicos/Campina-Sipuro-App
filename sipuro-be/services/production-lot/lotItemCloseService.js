'use strict';

/**
 * Penutupan item PO dari sisi alokasi lot: saat PPIC menyetujui permintaan close (Outstanding PO),
 * seluruh alokasi yang masih Open pada item itu menjadi Force Closed (termasuk yang qty-nya 0),
 * lengkap dengan riwayat per alokasi. Alokasi Closed dan Canceled tidak disentuh.
 * fulfilled_qty tidak berubah (Force Closed tetap dihitung; hanya Canceled yang dikeluarkan).
 *
 * Dipanggil di dalam transaksi ber-lock (helpers/lockedTransaction) dan setelah item PO terkunci.
 */

const { logAllocationUpdate } = require('./lotAllocationLog');
const { refreshBatchStatuses } = require('./lotStatusService');
const { ALLOCATION_STATUS } = require('./lotAllocationRules');

const CLOSE_APPROVED_REASON = 'PO item close approved'; // maksimum 50 karakter (kolom alasan)

/**
 * @returns {Promise<{ closedCount: number, batchIds: number[] }>}
 */
const forceCloseOpenAllocations = async (connection, { poDetailId, userId }) => {
    // Kunci semua alokasi item ini (urutan id tetap, sama dengan edit qty), lalu pilih yang Open.
    const [allocations] = await connection.query(
        `SELECT id, po_detail_id, lot_id, id_batch, allocated_qty, status
         FROM po_lot_allocations
         WHERE po_detail_id = ?
         ORDER BY id
         FOR UPDATE`,
        [poDetailId]
    );

    const open = allocations.filter((a) => a.status === ALLOCATION_STATUS.OPEN);
    if (open.length === 0) {
        return { closedCount: 0, batchIds: [] };
    }

    await connection.query(
        `UPDATE po_lot_allocations SET status = ?, updated_by = ?
         WHERE id IN (?) AND status = ?`,
        [ALLOCATION_STATUS.FORCE_CLOSED, userId, open.map((a) => a.id), ALLOCATION_STATUS.OPEN]
    );

    await logAllocationUpdate(connection, open.map((a) => ({
        allocation_id: a.id,
        po_detail_id: a.po_detail_id,
        lot_id: a.lot_id,
        id_batch: a.id_batch,
        old_allocated_qty: Number(a.allocated_qty) || 0,
        new_allocated_qty: Number(a.allocated_qty) || 0,
        old_status: a.status,
        new_status: ALLOCATION_STATUS.FORCE_CLOSED,
        reason: CLOSE_APPROVED_REASON,
        created_by: userId
    })), userId);

    const batchIds = [...new Set(open.map((a) => a.id_batch))];
    await refreshBatchStatuses(connection, batchIds);

    return { closedCount: open.length, batchIds };
};

module.exports = { CLOSE_APPROVED_REASON, forceCloseOpenAllocations };
