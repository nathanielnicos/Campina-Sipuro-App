'use strict';

const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');
const { logPOHeader, logPODetails } = require('../../helpers/poLogHelper');
const { BusinessError, sendControllerError } = require('../../helpers/businessError');
const { syncHeaderStatus } = require('../../helpers/outstanding-po/poStatusSync');
const rules = require('../../helpers/outstanding-po/closeRules');

/**
 * Alur Close PO Item:
 *   Customer: request close  (Active -> Close Requested)
 *   PPIC    : approve        (Close Requested -> Closed / Partially Closed)
 *   PPIC    : reject         (Close Requested -> Active)
 *
 * Semua pemeriksaan dilakukan SETELAH header dan item dikunci (FOR UPDATE) di dalam transaksi,
 * dan UPDATE selalu disertai syarat status, sehingga dua aksi yang berjalan bersamaan
 * tidak bisa saling menimpa. Pelaku selalu dari token login.
 */

const toBusinessError = (error) => {
    if (error && (error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT')) {
        return new BusinessError('Another update is in progress for this PO. Please try again.', 409);
    }
    return error;
};

/**
 * Menjalankan `work` dalam transaksi dengan header PO lalu item terkunci.
 * Urutan kunci selalu header -> item.
 */
const withLockedItem = async (poDetailId, work) => {
    const connection = await sipuroDb.getConnection();
    let inTransaction = false;
    try {
        await connection.beginTransaction();
        inTransaction = true;

        const [[ref]] = await connection.query(
            'SELECT po_header_id FROM sipuro_db.po_details WHERE po_detail_id = ?',
            [poDetailId]
        );
        if (!ref) throw new BusinessError('PO item not found.', 404);

        const [[header]] = await connection.query(
            `SELECT po_header_id, po_number, customer_id, status
             FROM sipuro_db.po_headers WHERE po_header_id = ? FOR UPDATE`,
            [ref.po_header_id]
        );
        if (!header) throw new BusinessError('PO item not found.', 404);

        const [[detail]] = await connection.query(
            `SELECT po_detail_id, po_header_id, id_product, qty, base_qty, fulfilled_qty, total_price, status, deleted_at
             FROM sipuro_db.po_details WHERE po_detail_id = ? AND po_header_id = ? FOR UPDATE`,
            [poDetailId, header.po_header_id]
        );
        if (!detail || detail.deleted_at) throw new BusinessError('PO item not found.', 404);

        const [[product]] = await connection.query(
            'SELECT product_code, product_name FROM sipuro_db.products WHERE id_product = ?',
            [detail.id_product]
        );

        const outcome = await work({ connection, header, detail, product: product || {} });

        await connection.commit();
        inTransaction = false;
        return outcome;
    } catch (error) {
        if (inTransaction) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }
        throw error;
    } finally {
        connection.release();
    }
};

const detailLog = (detail, newStatus) => ({
    po_detail_id: detail.po_detail_id,
    id_product: detail.id_product,
    old_qty: detail.qty,
    new_qty: detail.qty,
    old_base_qty: detail.base_qty,
    new_base_qty: detail.base_qty,
    old_total_price: detail.total_price,
    new_total_price: detail.total_price,
    old_status: detail.status,
    new_status: newStatus
});

const itemLink = (header, product) =>
    `/outstanding-po?po=${encodeURIComponent(header.po_number)}&product=${encodeURIComponent(product.product_code || '')}`;

// Notifikasi dikirim setelah commit; kegagalannya tidak boleh membatalkan hasil aksi.
const notifySafely = async (payload) => {
    try {
        await createNotification(payload);
    } catch (error) {
        console.error('Failed to send close notification:', error);
    }
};

/** CUSTOMER: ajukan penutupan sisa kuantitas satu item PO. */
exports.requestClose = async (req, res) => {
    try {
        const poDetailId = rules.parsePoDetailId(req.params.poDetailId);
        const reason = rules.parseReason(req.body && req.body.reason);
        const user = req.user;

        const { header, product } = await withLockedItem(poDetailId, async ({ connection, header, detail, product }) => {
            rules.assertOwnedByCustomer(header, user);
            rules.assertHeaderApproved(header);
            rules.assertCanRequestClose(detail);

            const [update] = await connection.query(
                `UPDATE sipuro_db.po_details SET status = 'Close Requested', close_reason = ?
                 WHERE po_detail_id = ? AND status = 'Active'`,
                [reason, detail.po_detail_id]
            );
            if (update.affectedRows !== 1) throw new BusinessError(rules.CONFLICT_MESSAGE, 409);

            const logId = await logPOHeader(connection, {
                poHeaderId: header.po_header_id,
                actionType: 'REQUEST_CLOSE_ITEM',
                oldStatus: null,
                newStatus: null,
                actionBy: user.id,
                reason
            });
            await logPODetails(connection, logId, [detailLog(detail, 'Close Requested')]);
            await syncHeaderStatus(connection, header.po_header_id);

            return { header, product };
        });

        await notifySafely({
            title: 'PO Item Close Requested',
            message: `${user.companyName || 'Customer'} requested to close item "${product.product_name || 'Item'}" on ${header.po_number}. Reason: "${reason}"`,
            recipientType: 'EMPLOYEE',
            recipientDepartment: 'PPIC',
            senderType: 'CUSTOMER',
            senderId: user.id,
            link: itemLink(header, product)
        });

        return res.json({ success: true, message: 'Close request submitted successfully.' });
    } catch (error) {
        return sendControllerError(res, toBusinessError(error), {
            label: 'Error requesting item close',
            fallbackMessage: 'Failed to submit close request.'
        });
    }
};

/** PPIC: setujui penutupan (Closed jika belum ada hasil produksi, Partially Closed jika sudah ada). */
exports.approveClose = async (req, res) => {
    try {
        const poDetailId = rules.parsePoDetailId(req.params.poDetailId);
        const user = req.user;

        const { header, product, targetStatus } = await withLockedItem(poDetailId, async ({ connection, header, detail, product }) => {
            rules.assertHeaderOpenForDecision(header);
            rules.assertPendingClose(detail);

            // Dihitung setelah item terkunci, jadi tidak bisa basi.
            const targetStatus = rules.targetStatusOnApprove(detail);

            const [update] = await connection.query(
                `UPDATE sipuro_db.po_details SET status = ?
                 WHERE po_detail_id = ? AND status = 'Close Requested'`,
                [targetStatus, detail.po_detail_id]
            );
            if (update.affectedRows !== 1) throw new BusinessError(rules.CONFLICT_MESSAGE, 409);

            const logId = await logPOHeader(connection, {
                poHeaderId: header.po_header_id,
                actionType: 'APPROVE_CLOSE_ITEM',
                oldStatus: null,
                newStatus: null,
                actionBy: user.id
            });
            await logPODetails(connection, logId, [detailLog(detail, targetStatus)]);
            await syncHeaderStatus(connection, header.po_header_id);

            return { header, product, targetStatus };
        });

        await notifySafely({
            title: 'PO Item Close Approved',
            message: `Your close request for item "${product.product_name || 'Item'}" on ${header.po_number} has been approved by PPIC.`,
            recipientType: 'CUSTOMER',
            recipientId: header.customer_id,
            senderType: 'EMPLOYEE',
            senderId: user.id,
            link: itemLink(header, product)
        });

        return res.json({ success: true, message: `Close request approved. Item status is now ${targetStatus}.` });
    } catch (error) {
        return sendControllerError(res, toBusinessError(error), {
            label: 'Error approving item close',
            fallbackMessage: 'Failed to approve item close.'
        });
    }
};

/** PPIC: tolak penutupan; item kembali Active dan alasan pengajuan dibersihkan. */
exports.rejectClose = async (req, res) => {
    try {
        const poDetailId = rules.parsePoDetailId(req.params.poDetailId);
        const user = req.user;

        const { header, product } = await withLockedItem(poDetailId, async ({ connection, header, detail, product }) => {
            rules.assertHeaderOpenForDecision(header);
            rules.assertPendingClose(detail);

            const [update] = await connection.query(
                `UPDATE sipuro_db.po_details SET status = 'Active', close_reason = NULL
                 WHERE po_detail_id = ? AND status = 'Close Requested'`,
                [detail.po_detail_id]
            );
            if (update.affectedRows !== 1) throw new BusinessError(rules.CONFLICT_MESSAGE, 409);

            const logId = await logPOHeader(connection, {
                poHeaderId: header.po_header_id,
                actionType: 'REJECT_CLOSE_ITEM',
                oldStatus: null,
                newStatus: null,
                actionBy: user.id,
                reason: null
            });
            await logPODetails(connection, logId, [detailLog(detail, 'Active')]);
            await syncHeaderStatus(connection, header.po_header_id);

            return { header, product };
        });

        await notifySafely({
            title: 'PO Item Close Request Rejected',
            message: `Your close request for item "${product.product_name || 'Item'}" on ${header.po_number} was rejected by PPIC.`,
            recipientType: 'CUSTOMER',
            recipientId: header.customer_id,
            senderType: 'EMPLOYEE',
            senderId: user.id,
            link: itemLink(header, product)
        });

        return res.json({ success: true, message: 'Close request rejected. The item is Active again.' });
    } catch (error) {
        return sendControllerError(res, toBusinessError(error), {
            label: 'Error rejecting item close',
            fallbackMessage: 'Failed to reject item close.'
        });
    }
};
