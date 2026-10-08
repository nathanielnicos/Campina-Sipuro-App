const { sipuroDb } = require('../../../config/db');
const { logAllocationUpdate } = require('../../../helpers/poBatchAllocationLogHelper');
const {
    refreshPODetailFulfilledQty,
    refreshBatchStatuses,
    refreshPOStatus
} = require('../../../helpers/batchHelper');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');
const { resolveValidUserId } = require('../../../helpers/userValidationHelper');

const SYNC_REASON = 'Auto status sync after quantity edit';

// Helper lokal untuk format pemisah ribuan (misal: 275600 -> 275.600)
const formatThousand = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return Number(val).toLocaleString('id-ID');
};

/**
 * Update Allocated Qty for PO Batch Allocation
 *
 * Setelah qty diubah, status SEMUA alokasi Open/Closed milik po_detail yang sama
 * disamakan (Closed jika total >= base_qty, selain itu Open), sama seperti commit upload produksi.
 * Alokasi Force Closed dan Canceled tidak disentuh.
 */
exports.updateAllocationQty = async (req, res) => {
    let connection = null;
    let inTransaction = false;

    try {
        const { allocationId } = req.params;
        const { newAllocatedQty, reason, userId: bodyUserId } = req.body;

        // Validasi allocationId
        if (!allocationId || isNaN(allocationId)) {
            throw new BusinessError('A valid Allocation ID is required.', 400);
        }

        // Validasi newAllocatedQty yang lebih ketat
        if (
            newAllocatedQty === undefined ||
            newAllocatedQty === null ||
            typeof newAllocatedQty === 'boolean' ||
            String(newAllocatedQty).trim() === '' ||
            isNaN(newAllocatedQty) ||
            Number(newAllocatedQty) < 0
        ) {
            throw new BusinessError('New allocated quantity must be a valid number greater than or equal to 0.', 400);
        }

        const parsedNewQty = Number(newAllocatedQty);
        if (!Number.isInteger(parsedNewQty)) {
            throw new BusinessError('New allocated quantity must be a whole number.', 400);
        }

        connection = await sipuroDb.getConnection();
        await connection.beginTransaction();
        inTransaction = true;

        const userId = await resolveValidUserId(connection, bodyUserId || (req.user ? req.user.id : null));

        // 1. Fetch current allocation record along with po_details info
        const [[allocation]] = await connection.query(`
            SELECT 
                pba.id,
                pba.po_detail_id,
                pba.id_batch,
                pba.allocated_qty,
                pba.status AS allocation_status,
                pd.po_header_id,
                pd.base_qty
            FROM sipuro_db.po_batch_allocations pba
            JOIN sipuro_db.po_details pd ON pba.po_detail_id = pd.po_detail_id
            WHERE pba.id = ? FOR UPDATE
        `, [allocationId]);

        if (!allocation) {
            throw new BusinessError('Allocation record not found.', 404);
        }

        const oldAllocatedQty = Number(allocation.allocated_qty) || 0;
        const currentStatus = allocation.allocation_status;

        // Cegah perubahan jika alokasi sudah Canceled
        if (currentStatus === 'Canceled') {
            throw new BusinessError('Cannot edit quantity for a canceled allocation.', 400);
        }

        // 2. Alokasi lain milik po_detail yang sama (dikunci agar status dapat disinkronkan dengan aman)
        const [siblings] = await connection.query(`
            SELECT id, id_batch, allocated_qty, status
            FROM sipuro_db.po_batch_allocations
            WHERE po_detail_id = ? AND id <> ?
            ORDER BY id
            FOR UPDATE
        `, [allocation.po_detail_id, allocationId]);

        const totalOthers = siblings
            .filter((s) => s.status !== 'Canceled')
            .reduce((sum, s) => sum + (Number(s.allocated_qty) || 0), 0);
        const newTotalPoAllocation = totalOthers + parsedNewQty;
        const baseQty = Number(allocation.base_qty) || 0;

        // Penjagaan: Mencegah total alokasi melebihi base_qty item PO
        if (newTotalPoAllocation > baseQty) {
            const maxAllowedForThisAllocation = Math.max(0, baseQty - totalOthers);
            throw new BusinessError(
                `Total allocated quantity cannot exceed PO base quantity (${formatThousand(baseQty)}). Maximum allowed for this allocation is ${formatThousand(maxAllowedForThisAllocation)}.`,
                400
            );
        }

        const targetAutoStatus = newTotalPoAllocation >= baseQty ? 'Closed' : 'Open';

        // Evaluasi ulang status hanya jika status awal adalah 'Open' atau 'Closed'
        let newStatus = currentStatus;
        if (currentStatus === 'Open' || currentStatus === 'Closed') {
            newStatus = targetAutoStatus;
        }

        // 3. Update po_batch_allocations (alokasi yang diedit)
        await connection.query(`
            UPDATE sipuro_db.po_batch_allocations 
            SET 
                allocated_qty = ?, 
                status = ?, 
                updated_by = ? 
            WHERE id = ?
        `, [parsedNewQty, newStatus, userId, allocationId]);

        // 4. Log update alokasi yang diedit
        await logAllocationUpdate(connection, [{
            allocation_id: allocation.id,
            po_detail_id: allocation.po_detail_id,
            id_batch: allocation.id_batch,
            old_allocated_qty: oldAllocatedQty,
            new_allocated_qty: parsedNewQty,
            old_status: currentStatus,
            new_status: newStatus,
            reason: reason,
            created_by: userId
        }], userId);

        // 5. Sinkronkan status alokasi LAIN (hanya Open/Closed) milik po_detail yang sama
        const toClosed = [];
        const toOpen = [];
        const syncLogs = [];
        const batchIdsToRefresh = new Set([allocation.id_batch]);

        siblings.forEach((s) => {
            if (!['Open', 'Closed'].includes(s.status) || s.status === targetAutoStatus) return;
            (targetAutoStatus === 'Closed' ? toClosed : toOpen).push(s.id);
            batchIdsToRefresh.add(s.id_batch);
            syncLogs.push({
                allocation_id: s.id,
                po_detail_id: allocation.po_detail_id,
                id_batch: s.id_batch,
                old_allocated_qty: Number(s.allocated_qty) || 0,
                new_allocated_qty: Number(s.allocated_qty) || 0,
                old_status: s.status,
                new_status: targetAutoStatus,
                reason: SYNC_REASON,
                created_by: userId
            });
        });

        if (toClosed.length > 0) {
            await connection.query(
                `UPDATE sipuro_db.po_batch_allocations SET status = 'Closed', updated_by = ? WHERE id IN (?)`,
                [userId, toClosed]
            );
        }
        if (toOpen.length > 0) {
            await connection.query(
                `UPDATE sipuro_db.po_batch_allocations SET status = 'Open', updated_by = ? WHERE id IN (?)`,
                [userId, toOpen]
            );
        }
        if (syncLogs.length > 0) {
            await logAllocationUpdate(connection, syncLogs, userId);
        }

        // 6. Sync po_details.fulfilled_qty, semua batches terkait, dan po_headers.status
        await refreshPODetailFulfilledQty(connection, allocation.po_detail_id);
        await refreshBatchStatuses(connection, [...batchIdsToRefresh]);
        await refreshPOStatus(connection, allocation.po_header_id);

        await connection.commit();
        inTransaction = false;

        // Format angka untuk tampilan pesan respons
        const formattedOldQty = formatThousand(oldAllocatedQty);
        const formattedNewQty = formatThousand(parsedNewQty);

        return res.status(200).json({
            success: true,
            message: `Allocated quantity successfully updated from ${formattedOldQty} to ${formattedNewQty}.`,
            data: {
                allocationId: allocation.id,
                oldAllocatedQty,
                newAllocatedQty: parsedNewQty,
                status: newStatus
            }
        });
    } catch (error) {
        if (connection && inTransaction) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }
        return sendControllerError(res, error, {
            label: 'Error updateAllocationQty',
            fallbackMessage: 'Internal server error while updating allocated quantity.'
        });
    } finally {
        if (connection) connection.release();
    }
};
