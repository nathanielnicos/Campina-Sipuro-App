const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');
const { logPOHeader } = require('../../helpers/poLogHelper');
const { getWibDateTimeString } = require('../../helpers/dateHelper');
const { safeError } = require('../../helpers/safeError');

// Keputusan PPIC yang diperbolehkan, dan satu-satunya status PO yang boleh diputuskan.
const ALLOWED_DECISIONS = ['Approved', 'Rejected'];
const STATUS_WAITING = 'Waiting for Confirmation';

/**
 * APPROVE / REJECT PO (UPDATE STATUS)
 */
exports.updatePOStatus = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const updated_by = req.user.id;
        if (!status) return res.status(400).json({ success: false, message: 'Status is required.' });
        if (!ALLOWED_DECISIONS.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be Approved or Rejected.' });
        }

        const cleanedReason = notes ? notes.trim().slice(0, 50) : null;

        if (status === 'Rejected' && !cleanedReason) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required (maximum 50 characters).' });
        }

        await connection.beginTransaction();

        // Kunci baris PO selama transaksi: jika pelanggan membatalkan PO pada saat yang sama,
        // salah satu aksi menunggu dan aksi kedua melihat status terbaru.
        const [poRows] = await connection.query(
            `SELECT po_number, customer_id, status FROM sipuro_db.po_headers WHERE po_header_id = ? FOR UPDATE`,
            [id]
        );

        if (poRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'PO data not found.' });
        }

        const targetPo = poRows[0];
        if (targetPo.status !== STATUS_WAITING) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `PO can only be approved or rejected while its status is ${STATUS_WAITING}.`
            });
        }

        const actionType = status === 'Rejected' ? 'REJECT' : 'APPROVE';

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
            link: '/po?search=' + encodeURIComponent(targetPo.po_number)
        });

        res.json({ success: true, message: `PO status successfully updated to ${status}.` });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating PO status:', error);
        res.status(500).json({ success: false, message: 'Failed to update PO status.', error: safeError(error) });
    } finally {
        connection.release();
    }
};
