const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');
const { logPOHeader } = require('../../helpers/poLogHelper');
const { getWibDateTimeString } = require('../../helpers/dateHelper');

/**
 * APPROVE / REJECT PO (UPDATE STATUS)
 */
exports.updatePOStatus = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { id } = req.params;
        const { status, notes, updated_by } = req.body;
        if (!status) return res.status(400).json({ success: false, message: 'Status is required.' });

        const cleanedReason = notes ? notes.trim().slice(0, 50) : null;

        if (status === 'Rejected' && !cleanedReason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required (maximum 50 characters).' });
        }

        const [poRows] = await connection.query(
            `SELECT po_number, customer_id, status FROM sipuro_db.po_headers WHERE po_header_id = ?`,
            [id]
        );

        if (poRows.length === 0) return res.status(404).json({ success: false, message: 'PO data not found.' });

        const targetPo = poRows[0];
        const actionType = status === 'Rejected' ? 'REJECT' : (status === 'Approved' ? 'APPROVE' : 'STATUS_AUTO_CHANGE');

        await connection.beginTransaction();

        // Menggunakan getWibDateTimeString() untuk mengisi timestamp WIB pada confirmed_at & updated_at
        const nowWib = getWibDateTimeString();

        await connection.query(
            `UPDATE sipuro_db.po_headers 
             SET status = ?, rejection_reason = ?, confirmed_by = ?, confirmed_at = ?, updated_at = ? 
             WHERE po_header_id = ?`,
            [status, cleanedReason, updated_by || null, nowWib, nowWib, id]
        );

        await logPOHeader(connection, {
            poHeaderId: id,
            actionType,
            oldStatus: targetPo.status,
            newStatus: status,
            actionBy: updated_by || null,
            reason: cleanedReason
        });

        await connection.commit();

        const isApproved = status === 'Approved';
        const notifTitle = isApproved ? 'PO Approved' : 'PO Rejected';
        const actionText = isApproved ? 'approved' : 'rejected';

        await createNotification({
            title: notifTitle,
            message: `${targetPo.po_number} has been ${actionText} by PPIC.${cleanedReason ? ` Reason: "${cleanedReason}"` : ''}`,
            recipientType: 'CUSTOMER',
            recipientId: targetPo.customer_id,
            senderType: 'EMPLOYEE',
            senderId: updated_by || null,
            link: '/po-list?search=' + encodeURIComponent(targetPo.po_number)
        });

        res.json({ success: true, message: `PO status successfully updated to ${status}.` });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating PO status:', error);
        res.status(500).json({ success: false, message: 'Failed to update PO status.', error: error.message });
    } finally {
        connection.release();
    }
};
