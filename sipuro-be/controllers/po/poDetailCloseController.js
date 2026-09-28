const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');
const { logPOHeader, logPODetails } = require('../../helpers/poLogHelper');
const { getWibDateTimeString } = require('../../helpers/dateHelper');

/**
 * 1. CUSTOMER: REQUEST CLOSE PO DETAILS
 * Pengajuan penutupan sisa kuantitas item PO oleh Customer
 */
exports.requestClosePoDetails = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { po_header_id, po_detail_ids, reason, requested_by } = req.body;

        if (!po_header_id || !po_detail_ids || !Array.isArray(po_detail_ids) || po_detail_ids.length === 0) {
            return res.status(400).json({ success: false, message: 'PO Header ID and selected detail items are required.' });
        }

        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'Reason for close request is required.' });
        }

        // 1. Ambil data PO Header untuk verifikasi dan notifikasi
        const [headerRows] = await connection.query(
            `SELECT h.po_number, h.customer_id, c.company_name 
             FROM sipuro_db.po_headers h
             LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id 
             WHERE h.po_header_id = ?`,
            [po_header_id]
        );
        if (headerRows.length === 0) {
            return res.status(404).json({ success: false, message: 'PO Header not found.' });
        }
        const poData = headerRows[0];

        // 2. Ambil detail item yang valid (Status 'Active' dan belum soft delete)
        const [validDetails] = await connection.query(
            `SELECT po_detail_id, id_product, qty, base_qty, fulfilled_qty, total_price, status 
             FROM sipuro_db.po_details 
             WHERE po_header_id = ? AND po_detail_id IN (?) AND deleted_at IS NULL AND status = 'Active'`,
            [po_header_id, po_detail_ids]
        );

        if (validDetails.length === 0) {
            return res.status(400).json({ success: false, message: 'No eligible Active items found to request close.' });
        }

        const nowWib = getWibDateTimeString();
        const validIds = validDetails.map(d => d.po_detail_id);

        await connection.beginTransaction();

        // 3. Update status item menjadi 'Close Requested' dan simpan alasan di notes/close_reason
        await connection.query(
            `UPDATE sipuro_db.po_details 
             SET status = 'Close Requested', notes = ? 
             WHERE po_detail_id IN (?)`,
            [reason.trim(), validIds]
        );

        // 4. Catat Audit Log
        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId: po_header_id,
            actionType: 'REQUEST_CLOSE_ITEM',
            oldStatus: null,
            newStatus: null,
            actionBy: requested_by || poData.customer_id,
            reason: reason.trim()
        });

        const detailLogs = validDetails.map(item => ({
            po_detail_id: item.po_detail_id,
            id_product: item.id_product,
            old_qty: item.qty,
            new_qty: item.qty,
            old_base_qty: item.base_qty,
            new_base_qty: item.base_qty,
            old_total_price: item.total_price,
            new_total_price: item.total_price,
            old_status: item.status,
            new_status: 'Close Requested'
        }));

        await logPODetails(connection, poHeaderLogId, detailLogs);

        await connection.commit();

        // 5. Kirim Notifikasi ke Tim PPIC
        await createNotification({
            title: 'PO Item Close Requested',
            message: `${poData.company_name || 'Customer'} requested to close ${validIds.length} item(s) on ${poData.po_number}.`,
            recipientType: 'EMPLOYEE',
            recipientDepartment: 'PPIC',
            senderType: 'CUSTOMER',
            senderId: requested_by || poData.customer_id,
            link: '/ppic-batch'
        });

        res.json({
            success: true,
            message: `Successfully submitted close request for ${validIds.length} item(s).`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error requesting item close:', error);
        res.status(500).json({ success: false, message: 'Failed to submit close request.', error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * 2. PPIC: APPROVE CLOSE PO DETAILS
 * Persetujuan penutupan item PO oleh PPIC (Closed vs Partially Closed berdasarkan fulfilled_qty)
 */
exports.approveClosePoDetails = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { po_header_id, po_detail_ids, approved_by } = req.body;

        if (!po_header_id || !po_detail_ids || !Array.isArray(po_detail_ids) || po_detail_ids.length === 0) {
            return res.status(400).json({ success: false, message: 'PO Header ID and selected detail items are required.' });
        }

        // 1. Ambil data Header PO
        const [headerRows] = await connection.query(
            `SELECT po_number, customer_id FROM sipuro_db.po_headers WHERE po_header_id = ?`,
            [po_header_id]
        );
        if (headerRows.length === 0) {
            return res.status(404).json({ success: false, message: 'PO Header not found.' });
        }
        const poData = headerRows[0];

        // 2. Ambil detail item berstatus 'Close Requested'
        const [requestedDetails] = await connection.query(
            `SELECT po_detail_id, id_product, qty, base_qty, fulfilled_qty, total_price, status 
             FROM sipuro_db.po_details 
             WHERE po_header_id = ? AND po_detail_id IN (?) AND deleted_at IS NULL AND status = 'Close Requested'`,
            [po_header_id, po_detail_ids]
        );

        if (requestedDetails.length === 0) {
            return res.status(400).json({ success: false, message: 'No items with pending Close Requested status found.' });
        }

        await connection.beginTransaction();

        const detailLogs = [];

        // 3. Evaluasi dan Update status per item (Closed vs Partially Closed)
        for (const item of requestedDetails) {
            const fulfilledQty = Number(item.fulfilled_qty) || 0;
            const targetStatus = fulfilledQty > 0 ? 'Partially Closed' : 'Closed';

            await connection.query(
                `UPDATE sipuro_db.po_details SET status = ? WHERE po_detail_id = ?`,
                [targetStatus, item.po_detail_id]
            );

            detailLogs.push({
                po_detail_id: item.po_detail_id,
                id_product: item.id_product,
                old_qty: item.qty,
                new_qty: item.qty,
                old_base_qty: item.base_qty,
                new_base_qty: item.base_qty,
                old_total_price: item.total_price,
                new_total_price: item.total_price,
                old_status: item.status,
                new_status: targetStatus
            });
        }

        // 4. Catat Audit Log Header & Details
        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId: po_header_id,
            actionType: 'APPROVE_CLOSE_ITEM',
            oldStatus: null,
            newStatus: null,
            actionBy: approved_by || null
        });

        await logPODetails(connection, poHeaderLogId, detailLogs);

        await connection.commit();

        // 5. Notifikasi Balik ke Customer
        await createNotification({
            title: 'PO Item Close Approved',
            message: `Your close request for ${requestedDetails.length} item(s) on ${poData.po_number} has been approved by PPIC.`,
            recipientType: 'CUSTOMER',
            recipientId: poData.customer_id,
            senderType: 'EMPLOYEE',
            senderId: approved_by || null,
            link: '/ppic-batch'
        });

        res.json({
            success: true,
            message: `Successfully approved close request for ${requestedDetails.length} item(s).`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error approving item close:', error);
        res.status(500).json({ success: false, message: 'Failed to approve item close.', error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * 3. PPIC: REJECT CLOSE PO DETAILS
 * Penolakan penutupan item PO oleh PPIC (Kembali ke status Active)
 */
exports.rejectClosePoDetails = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { po_header_id, po_detail_ids, reject_reason, rejected_by } = req.body;

        if (!po_header_id || !po_detail_ids || !Array.isArray(po_detail_ids) || po_detail_ids.length === 0) {
            return res.status(400).json({ success: false, message: 'PO Header ID and selected detail items are required.' });
        }

        // 1. Ambil data Header PO
        const [headerRows] = await connection.query(
            `SELECT po_number, customer_id FROM sipuro_db.po_headers WHERE po_header_id = ?`,
            [po_header_id]
        );
        if (headerRows.length === 0) {
            return res.status(404).json({ success: false, message: 'PO Header not found.' });
        }
        const poData = headerRows[0];

        // 2. Ambil detail item berstatus 'Close Requested'
        const [requestedDetails] = await connection.query(
            `SELECT po_detail_id, id_product, qty, base_qty, total_price, status 
             FROM sipuro_db.po_details 
             WHERE po_header_id = ? AND po_detail_id IN (?) AND deleted_at IS NULL AND status = 'Close Requested'`,
            [po_header_id, po_detail_ids]
        );

        if (requestedDetails.length === 0) {
            return res.status(400).json({ success: false, message: 'No items with pending Close Requested status found.' });
        }

        await connection.beginTransaction();

        const validIds = requestedDetails.map(d => d.po_detail_id);

        // 3. Kembalikan status item ke 'Active'
        await connection.query(
            `UPDATE sipuro_db.po_details SET status = 'Active' WHERE po_detail_id IN (?)`,
            [validIds]
        );

        // 4. Catat Audit Log
        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId: po_header_id,
            actionType: 'REJECT_CLOSE_ITEM',
            oldStatus: null,
            newStatus: null,
            actionBy: rejected_by || null,
            reason: reject_reason || null
        });

        const detailLogs = requestedDetails.map(item => ({
            po_detail_id: item.po_detail_id,
            id_product: item.id_product,
            old_qty: item.qty,
            new_qty: item.qty,
            old_base_qty: item.base_qty,
            new_base_qty: item.base_qty,
            old_total_price: item.total_price,
            new_total_price: item.total_price,
            old_status: item.status,
            new_status: 'Active'
        }));

        await logPODetails(connection, poHeaderLogId, detailLogs);

        await connection.commit();

        // 5. Notifikasi Penolakan ke Customer
        const reasonText = reject_reason ? ` Reason: "${reject_reason}"` : '';
        await createNotification({
            title: 'PO Item Close Request Rejected',
            message: `Your close request for ${validIds.length} item(s) on ${poData.po_number} was rejected by PPIC.${reasonText}`,
            recipientType: 'CUSTOMER',
            recipientId: poData.customer_id,
            senderType: 'EMPLOYEE',
            senderId: rejected_by || null,
            link: '/ppic-batch'
        });

        res.json({
            success: true,
            message: `Close request for ${validIds.length} item(s) has been rejected.`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error rejecting item close:', error);
        res.status(500).json({ success: false, message: 'Failed to reject item close.', error: error.message });
    } finally {
        connection.release();
    }
};
