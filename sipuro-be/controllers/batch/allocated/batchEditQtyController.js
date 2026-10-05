const { sipuroDb } = require('../../../config/db');
const { logAllocationUpdate } = require('../../../helpers/poBatchAllocationLogHelper');
const {
    refreshPODetailFulfilledQty,
    refreshBatchStatus,
    refreshPOStatus
} = require('../../../helpers/batchHelper');

// Helper lokal untuk format pemisah ribuan (misal: 275600 -> 275.600)
const formatThousand = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return Number(val).toLocaleString('id-ID');
};

/**
 * Update Allocated Qty for PO Batch Allocation
 */
exports.updateAllocationQty = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        await connection.beginTransaction();

        const { allocationId } = req.params;
        const { newAllocatedQty, reason, userId: bodyUserId } = req.body;
        const userId = bodyUserId || (req.user ? req.user.id : null);

        // Validasi allocationId
        if (!allocationId || isNaN(allocationId)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'A valid Allocation ID is required.'
            });
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
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'New allocated quantity must be a valid number greater than or equal to 0.'
            });
        }

        const parsedNewQty = Number(newAllocatedQty);

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
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Allocation record not found.'
            });
        }

        const oldAllocatedQty = Number(allocation.allocated_qty) || 0;
        const currentStatus = allocation.allocation_status;

        // Cegah perubahan jika alokasi sudah Canceled
        if (currentStatus === 'Canceled') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Cannot edit quantity for a canceled allocation.'
            });
        }

        // 2. Calculate updated total allocation for this po_detail to determine new auto status
        const [[sumOtherAllocations]] = await connection.query(`
            SELECT COALESCE(SUM(allocated_qty), 0) AS total_others
            FROM sipuro_db.po_batch_allocations
            WHERE po_detail_id = ? AND id != ? AND status != 'Canceled'
        `, [allocation.po_detail_id, allocationId]);

        const totalOthers = Number(sumOtherAllocations.total_others) || 0;
        const newTotalPoAllocation = totalOthers + parsedNewQty;
        const baseQty = Number(allocation.base_qty) || 0;

        // Penjagaan: Mencegah total alokasi melebihi base_qty item PO
        if (newTotalPoAllocation > baseQty) {
            await connection.rollback();
            const maxAllowedForThisAllocation = Math.max(0, baseQty - totalOthers);
            return res.status(400).json({
                success: false,
                message: `Total allocated quantity cannot exceed PO base quantity (${formatThousand(baseQty)}). Maximum allowed for this allocation is ${formatThousand(maxAllowedForThisAllocation)}.`
            });
        }

        // Evaluasi ulang status hanya jika status awal adalah 'Open' atau 'Closed'
        let newStatus = currentStatus;
        if (currentStatus === 'Open' || currentStatus === 'Closed') {
            newStatus = newTotalPoAllocation >= baseQty ? 'Closed' : 'Open';
        }

        // 3. Update po_batch_allocations
        await connection.query(`
            UPDATE sipuro_db.po_batch_allocations 
            SET 
                allocated_qty = ?, 
                status = ?, 
                updated_by = ? 
            WHERE id = ?
        `, [parsedNewQty, newStatus, userId, allocationId]);

        // 4. Log update action via helper
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

        // 5. Sync po_details.fulfilled_qty, batches.status, and po_headers.status
        await refreshPODetailFulfilledQty(connection, allocation.po_detail_id);
        await refreshBatchStatus(connection, allocation.id_batch);
        await refreshPOStatus(connection, allocation.po_header_id);

        await connection.commit();

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
        await connection.rollback();
        console.error('Error updateAllocationQty:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while updating allocated quantity.',
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    } finally {
        connection.release();
    }
};
