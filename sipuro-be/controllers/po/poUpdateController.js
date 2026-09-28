const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');
const { logPOHeader, logPODetails } = require('../../helpers/poLogHelper');
const { getWibDateTimeString } = require('../../helpers/dateHelper');
const { calculateBaseQty } = require('../../helpers/poHelper');

/**
 * UPDATE PO (REVISI QTY ITEM & STATUS)
 */
exports.updatePO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { id } = req.params;
        const { delivery_address, description, items, updated_by, status } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Incomplete request data.' });
        }

        const safeDescription = description ? description.trim().slice(0, 50) : null;

        const [checkRows] = await connection.query(
            `SELECT h.po_number, h.status, h.customer_id, c.company_name 
             FROM sipuro_db.po_headers h
             LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id 
             WHERE h.po_header_id = ?`,
            [id]
        );
        if (checkRows.length === 0) return res.status(404).json({ success: false, message: 'PO not found.' });

        const poData = checkRows[0];
        // Memperbolehkan update jika status 'Draft' atau 'Waiting for Confirmation'
        if (!['Draft', 'Waiting for Confirmation'].includes(poData.status)) {
            return res.status(400).json({ success: false, message: 'PO cannot be updated because of its current status.' });
        }

        const newStatus = status || poData.status;

        // AMBIL STATUS DETAIL EKSISTING UNTUK CATATAN LOG
        const [existingDetails] = await connection.query(
            `SELECT po_detail_id, id_product, qty, base_qty, total_price, status 
             FROM sipuro_db.po_details 
             WHERE po_header_id = ? AND deleted_at IS NULL`,
            [id]
        );
        const existingMap = new Map(existingDetails.map(row => [row.po_detail_id, row]));

        const [profileRows] = await sipuroDb.query(`SELECT ppn_percent FROM sipuro_db.company_profile LIMIT 1`);
        const ppn_percent = profileRows.length > 0 && profileRows[0].ppn_percent !== null ? parseFloat(profileRows[0].ppn_percent) : 11;

        let subtotal = 0;
        items.forEach(item => {
            const itemPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            subtotal += (itemPrice * qty);
        });
        const total_amount = subtotal + (subtotal * (ppn_percent / 100));

        const productIds = items.map(item => item.id_product);
        const [productRows] = await sipuroDb.query(
            `SELECT id_product, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs FROM sipuro_db.products WHERE id_product IN (?)`,
            [productIds]
        );
        const productMap = new Map(productRows.map(p => [p.id_product, p]));

        const nowWib = getWibDateTimeString();

        await connection.beginTransaction();

        // Update Header beserta update status & updated_at WIB
        await connection.query(
            `UPDATE sipuro_db.po_headers SET subtotal = ?, ppn_percent = ?, total_amount = ?, delivery_address = ?, description = ?, status = ?, updated_by = ?, updated_at = ? WHERE po_header_id = ?`,
            [subtotal, ppn_percent, total_amount, delivery_address || '', safeDescription, newStatus, updated_by || null, nowWib, id]
        );

        const existingIds = existingDetails.map(row => row.po_detail_id);
        const payloadDetailIds = items.map(item => item.po_detail_id).filter(Boolean);

        const detailLogsToSave = [];
        const idsToDelete = existingIds.filter(detailId => !payloadDetailIds.includes(detailId));

        // PENANGANAN BARIS YANG DIHAPUS SAAT EDIT
        if (idsToDelete.length > 0) {
            await connection.query(
                `UPDATE sipuro_db.po_details SET status = 'Deleted', deleted_at = ? WHERE po_detail_id IN (?)`,
                [nowWib, idsToDelete]
            );
            for (const delId of idsToDelete) {
                const oldItem = existingMap.get(delId);
                detailLogsToSave.push({
                    po_detail_id: delId,
                    id_product: oldItem.id_product,
                    old_qty: oldItem.qty,
                    new_qty: 0,
                    old_base_qty: oldItem.base_qty,
                    new_base_qty: 0,
                    old_total_price: oldItem.total_price,
                    new_total_price: 0,
                    old_status: oldItem.status || 'Active',
                    new_status: 'Deleted'
                });
            }
        }

        for (const item of items) {
            const unitPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            const totalPrice = item.total_price !== undefined ? parseFloat(item.total_price) : (unitPrice * qty);
            const selectedUom = item.selected_uom || item.uom || item.base_uom || 'PCS';

            const product = productMap.get(item.id_product) || {};
            const pcsPerCtn = Number(product.pcs_per_ctn || 1);
            const ctnPerPlt = Number(product.ctn_per_plt || 1);
            const mlPerPcs = product.ml_per_pcs !== undefined ? product.ml_per_pcs : null;
            const kgPerPcs = product.kg_per_pcs !== undefined ? product.kg_per_pcs : null;

            const baseQty = calculateBaseQty(qty, selectedUom, product);
            const basePrice = baseQty > 0 ? (totalPrice / baseQty) : unitPrice;

            if (item.po_detail_id && existingMap.has(item.po_detail_id)) {
                const oldItem = existingMap.get(item.po_detail_id);

                if (oldItem.qty !== qty || oldItem.total_price !== totalPrice) {
                    detailLogsToSave.push({
                        po_detail_id: item.po_detail_id,
                        id_product: item.id_product,
                        old_qty: oldItem.qty,
                        new_qty: qty,
                        old_base_qty: oldItem.base_qty,
                        new_base_qty: baseQty,
                        old_total_price: oldItem.total_price,
                        new_total_price: totalPrice,
                        old_status: oldItem.status || 'Active',
                        new_status: oldItem.status || 'Active'
                    });
                }

                await connection.query(
                    `UPDATE sipuro_db.po_details 
                     SET id_product = ?, qty = ?, base_qty = ?, uom = ?, pcs_per_ctn = ?, ctn_per_plt = ?, ml_per_pcs = ?, kg_per_pcs = ?, base_price = ?, total_price = ?, notes = ? 
                     WHERE po_detail_id = ?`,
                    [
                        item.id_product,
                        qty,
                        baseQty,
                        selectedUom,
                        pcsPerCtn,
                        ctnPerPlt,
                        mlPerPcs,
                        kgPerPcs,
                        basePrice,
                        totalPrice,
                        item.notes || null,
                        item.po_detail_id
                    ]
                );
            } else {
                // PENANGANAN BARIS BARU DITAMBAHKAN
                const [newDet] = await connection.query(
                    `INSERT INTO sipuro_db.po_details 
                     (po_header_id, id_product, qty, base_qty, uom, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs, base_price, total_price, status, notes) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)`,
                    [
                        id,
                        item.id_product,
                        qty,
                        baseQty,
                        selectedUom,
                        pcsPerCtn,
                        ctnPerPlt,
                        mlPerPcs,
                        kgPerPcs,
                        basePrice,
                        totalPrice,
                        item.notes || null
                    ]
                );

                detailLogsToSave.push({
                    po_detail_id: newDet.insertId,
                    id_product: item.id_product,
                    old_qty: 0,
                    new_qty: qty,
                    old_base_qty: 0,
                    new_base_qty: baseQty,
                    old_total_price: 0,
                    new_total_price: totalPrice,
                    old_status: null,
                    new_status: 'Active'
                });
            }
        }

        // Catat Audit Trail UPDATE_QTY atau perubahan status
        const actionType = (poData.status === 'Draft' && newStatus === 'Waiting for Confirmation') ? 'SUBMIT' : 'UPDATE_QTY';

        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId: id,
            actionType,
            oldStatus: poData.status,
            newStatus,
            actionBy: updated_by || poData.customer_id
        });

        await logPODetails(connection, poHeaderLogId, detailLogsToSave);

        await connection.commit();

        // Kirim Notifikasi ke PPIC jika baru dipublish dari Draft ke Waiting for Confirmation ATAU sekadar diupdate saat Waiting
        if (newStatus === 'Waiting for Confirmation') {
            const isFirstSubmit = poData.status === 'Draft';
            await createNotification({
                title: isFirstSubmit ? 'New PO Received' : 'PO Updated',
                message: isFirstSubmit
                    ? `${poData.po_number} has been submitted by ${poData.company_name || 'Customer'}.`
                    : `${poData.po_number} has been updated by ${poData.company_name || 'Customer'}.`,
                recipientType: 'EMPLOYEE',
                recipientDepartment: 'PPIC',
                senderType: 'CUSTOMER',
                senderId: updated_by || poData.customer_id,
                link: '/po-list'
            });
        }

        res.json({ success: true, message: 'Purchase Order updated successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating PO:', error);
        res.status(500).json({ success: false, message: 'Failed to update Purchase Order.', error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * CANCEL PO
 */
exports.cancelPO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { id } = req.params;
        const { canceled_by, reason } = req.body;

        const [checkRows] = await connection.query(
            `SELECT h.po_number, h.status, h.customer_id, c.company_name 
             FROM sipuro_db.po_headers h
             LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id 
             WHERE h.po_header_id = ?`,
            [id]
        );
        if (checkRows.length === 0) return res.status(404).json({ success: false, message: 'PO not found.' });

        const poData = checkRows[0];
        // Memperbolehkan cancel jika status 'Draft' atau 'Waiting for Confirmation'
        if (!['Draft', 'Waiting for Confirmation'].includes(poData.status)) {
            return res.status(400).json({ success: false, message: 'PO cannot be canceled because of its current status.' });
        }

        const nowWib = getWibDateTimeString();

        await connection.beginTransaction();

        // Update Header
        await connection.query(
            `UPDATE sipuro_db.po_headers SET status = 'Canceled', updated_by = ?, updated_at = ? WHERE po_header_id = ?`,
            [canceled_by || null, nowWib, id]
        );

        // Update semua baris detail yang masih aktif menjadi 'Deleted'
        const [activeDetails] = await connection.query(
            `SELECT po_detail_id, id_product, qty, base_qty, total_price, status 
             FROM sipuro_db.po_details 
             WHERE po_header_id = ? AND deleted_at IS NULL`,
            [id]
        );

        if (activeDetails.length > 0) {
            await connection.query(
                `UPDATE sipuro_db.po_details SET status = 'Deleted', deleted_at = ? WHERE po_header_id = ? AND deleted_at IS NULL`,
                [nowWib, id]
            );
        }

        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId: id,
            actionType: 'CANCEL',
            oldStatus: poData.status,
            newStatus: 'Canceled',
            actionBy: canceled_by || poData.customer_id,
            reason: reason || null
        });

        // Catat log detail jika ada item aktif yang dibatalkan
        if (activeDetails.length > 0) {
            const cancelDetailLogs = activeDetails.map(item => ({
                po_detail_id: item.po_detail_id,
                id_product: item.id_product,
                old_qty: item.qty,
                new_qty: 0,
                old_base_qty: item.base_qty,
                new_base_qty: 0,
                old_total_price: item.total_price,
                new_total_price: 0,
                old_status: item.status || 'Active',
                new_status: 'Deleted'
            }));
            await logPODetails(connection, poHeaderLogId, cancelDetailLogs);
        }

        await connection.commit();

        // Notifikasi ke PPIC hanya dikirim jika PO yang dibatalkan sebelumnya sudah di-submit ke PPIC
        if (poData.status === 'Waiting for Confirmation') {
            await createNotification({
                title: 'PO Canceled',
                message: `${poData.po_number} has been canceled by ${poData.company_name || 'Customer'}.`,
                recipientType: 'EMPLOYEE',
                recipientDepartment: 'PPIC',
                senderType: 'CUSTOMER',
                senderId: canceled_by || poData.customer_id,
                link: '/po-list'
            });
        }

        res.json({ success: true, message: 'Purchase Order canceled successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error cancelling PO:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel Purchase Order.', error: error.message });
    } finally {
        connection.release();
    }
};
