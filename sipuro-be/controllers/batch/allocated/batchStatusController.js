const { sipuroDb } = require('../../../config/db');
const { refreshPOStatus, refreshBatchStatus } = require('../../../helpers/batchHelper');
const { logAllocationUpdate } = require('../../../helpers/poBatchAllocationLogHelper');

exports.updateAllocationStatus = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        await connection.beginTransaction();

        const { allocationId } = req.params;
        const { action, reason } = req.body;
        const userId = req.user ? req.user.id : null;

        const [[allocation]] = await connection.query(`
            SELECT pba.*, pd.po_header_id 
            FROM sipuro_db.po_batch_allocations pba
            JOIN sipuro_db.po_details pd ON pba.po_detail_id = pd.po_detail_id
            WHERE pba.id = ? FOR UPDATE
        `, [allocationId]);

        if (!allocation) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Allocation data not found.' });
        }

        let newStatus = '';
        if (action === 'CANCEL') {
            if (Number(allocation.fulfilled_qty) > 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Allocation with fulfilled quantity > 0 cannot be canceled.'
                });
            }
            newStatus = 'Canceled';
        } else if (action === 'FORCE_CLOSE') {
            if (Number(allocation.fulfilled_qty) >= Number(allocation.allocated_qty)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Allocation is already fully fulfilled. Use normal Closed status.'
                });
            }
            newStatus = 'Force Closed';
        } else {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Invalid action type.' });
        }

        await connection.query(
            `UPDATE sipuro_db.po_batch_allocations SET status = ? WHERE id = ?`,
            [newStatus, allocationId]
        );

        await logAllocationUpdate(connection, {
            allocation_id: allocationId,
            po_detail_id: allocation.po_detail_id,
            id_batch: allocation.id_batch,
            old_fulfilled_qty: allocation.fulfilled_qty || 0,
            new_fulfilled_qty: allocation.fulfilled_qty || 0,
            old_status: allocation.status,
            new_status: newStatus,
            reason: reason || `Manual ${action} action`,
            created_by: userId || allocation.created_by || 1
        });

        await refreshPOStatus(connection, allocation.po_header_id);
        await refreshBatchStatus(connection, allocation.id_batch);

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
            message: 'Internal server error.',
            error: error.message
        });
    } finally {
        connection.release();
    }
};
