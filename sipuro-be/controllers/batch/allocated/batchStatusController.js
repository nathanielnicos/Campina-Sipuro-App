const { sipuroDb } = require('../../../config/db');
const { refreshPOStatus, refreshBatchStatus } = require('../../../helpers/batchHelper');
const { logAllocationUpdate } = require('../../../helpers/poBatchAllocationLogHelper');

/**
 * Update Allocation Status (Only supports FORCE_CLOSE)
 */
exports.updateAllocationStatus = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        await connection.beginTransaction();

        const { allocationId } = req.params;
        const { action, reason, userId: bodyUserId } = req.body;
        const userId = bodyUserId || (req.user ? req.user.id : null);

        if (action !== 'FORCE_CLOSE') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Invalid action type. Only "FORCE_CLOSE" action is supported.'
            });
        }

        // 1. Fetch current allocation detail along with po_details info
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
            return res.status(404).json({ success: false, message: 'Allocation record not found.' });
        }

        if (allocation.allocation_status === 'Force Closed') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Allocation is already Force Closed.'
            });
        }

        // 2. Check total allocated quantity for this po_detail_id vs base_qty
        const [[sumTotalAllocation]] = await connection.query(`
            SELECT COALESCE(SUM(allocated_qty), 0) AS total_allocated
            FROM sipuro_db.po_batch_allocations
            WHERE po_detail_id = ? AND status != 'Canceled'
        `, [allocation.po_detail_id]);

        const totalAllocated = Number(sumTotalAllocation.total_allocated) || 0;
        const baseQty = Number(allocation.base_qty) || 0;

        // Force close is only allowed if total allocated quantity is less than base_qty (under 100%)
        if (totalAllocated >= baseQty) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Allocation is already fully fulfilled (>= 100%). It is automatically set to Closed status and cannot be Force Closed.'
            });
        }

        const newStatus = 'Force Closed';

        // 3. Update po_batch_allocations status
        await connection.query(
            `UPDATE sipuro_db.po_batch_allocations SET status = ?, updated_by = ? WHERE id = ?`,
            [newStatus, userId, allocationId]
        );

        // 4. Log status change
        await logAllocationUpdate(connection, [{
            allocation_id: allocationId,
            po_detail_id: allocation.po_detail_id,
            id_batch: allocation.id_batch,
            old_allocated_qty: allocation.allocated_qty || 0,
            new_allocated_qty: allocation.allocated_qty || 0,
            old_status: allocation.allocation_status,
            new_status: newStatus,
            reason: reason,
            created_by: userId
        }], userId);

        // 5. Refresh batch and PO header status
        await refreshBatchStatus(connection, allocation.id_batch);
        await refreshPOStatus(connection, allocation.po_header_id);

        await connection.commit();
        return res.status(200).json({
            success: true,
            message: `Allocation status successfully updated to ${newStatus}.`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updateAllocationStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while updating allocation status.',
            error: error.message
        });
    } finally {
        connection.release();
    }
};
