const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');
const { logPOHeader, logPODetails } = require('../../helpers/poLogHelper');
const { getWibDateTimeString } = require('../../helpers/dateHelper');
const { priceItems } = require('../../helpers/poPricing');
const { safeError } = require('../../helpers/safeError');

/**
 * UPDATE PO (REVISI QTY ITEM & STATUS)
 */
exports.updatePO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { id } = req.params;
        const { delivery_address, description, items, status } = req.body;
        const updated_by = req.user.id;

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
        if (Number(poData.customer_id) !== Number(req.user.customerId)) {
            return res.status(404).json({ success: false, message: 'PO not found.' });
        }
        // Memperbolehkan update jika status 'Draft' atau 'Waiting for Confirmation'
        if (!['Draft', 'Waiting for Confirmation'].includes(poData.status)) {
            return res.status(400).json({ success: false, message: 'PO cannot be updated because of its current status.' });
        }

        const newStatus = status || poData.status;

        // AMBIL STATUS DETAIL EKSISTING UNTUK CATATAN LOG
        const [existingDetails] = await connection.query(
            `SELECT po_detail_id, id_product, qty, base_qty, base_price, total_price, status 
             FROM sipuro_db.po_details 
             WHERE po_header_id = ? AND deleted_at IS NULL`,
            [id]
        );
        const existingMap = new Map(existingDetails.map(row => [row.po_detail_id, row]));

        const [profileRows] = await sipuroDb.query(`SELECT ppn_percent FROM sipuro_db.company_profile LIMIT 1`);
        const ppn_percent = profileRows.length > 0 && profileRows[0].ppn_percent !== null ? parseFloat(profileRows[0].ppn_percent) : 11;

        // Harga dihitung ulang di server. Draft: semua baris memakai harga hari ini.
        // Waiting for Confirmation: baris lama dengan produk yang sama tetap memakai harga tersimpan.
        // unit_price / total_price dari klien tidak dipakai.
        const pricing = await priceItems({
            db: connection,
            items,
            poStatus: poData.status,
            existingMap,
            ppnPercent: ppn_percent
        });
        const subtotal = pricing.subtotal;
        const total_amount = pricing.totalAmount;

        const nowWib = getWibDateTimeString();

        await connection.beginTransaction();

        // Update Header beserta update status & updated_at WIB
        await connection.query(
            `UPDATE sipuro_db.po_headers SET subtotal = ?, ppn_percent = ?, total_amount = ?, delivery_address = ?, description = ?, status = ?, updated_by = ?, updated_at = ? WHERE po_header_id = ?`,
            [subtotal, ppn_percent, total_amount, delivery_address || '', safeDescription, newStatus, updated_by || null, nowWib, id]
        );

        const existingIds = existingDetails.map(row => row.po_detail_id);
        const payloadDetailIds = pricing.lines.map(line => line.po_detail_id).filter(Boolean);

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

        for (const line of pricing.lines) {
            if (line.po_detail_id && existingMap.has(line.po_detail_id)) {
                const oldItem = existingMap.get(line.po_detail_id);

                if (oldItem.qty !== line.qty || oldItem.total_price !== line.totalPrice) {
                    detailLogsToSave.push({
                        po_detail_id: line.po_detail_id,
                        id_product: line.id_product,
                        old_qty: oldItem.qty,
                        new_qty: line.qty,
                        old_base_qty: oldItem.base_qty,
                        new_base_qty: line.baseQty,
                        old_total_price: oldItem.total_price,
                        new_total_price: line.totalPrice,
                        old_status: oldItem.status || 'Active',
                        new_status: oldItem.status || 'Active'
                    });
                }

                await connection.query(
                    `UPDATE sipuro_db.po_details 
                     SET id_product = ?, qty = ?, base_qty = ?, uom = ?, pcs_per_ctn = ?, ctn_per_plt = ?, ml_per_pcs = ?, kg_per_pcs = ?, base_price = ?, total_price = ?, notes = ? 
                     WHERE po_detail_id = ?`,
                    [
                        line.id_product,
                        line.qty,
                        line.baseQty,
                        line.uom,
                        line.pcsPerCtn,
                        line.ctnPerPlt,
                        line.mlPerPcs,
                        line.kgPerPcs,
                        line.basePrice,
                        line.totalPrice,
                        line.notes,
                        line.po_detail_id
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
                        line.id_product,
                        line.qty,
                        line.baseQty,
                        line.uom,
                        line.pcsPerCtn,
                        line.ctnPerPlt,
                        line.mlPerPcs,
                        line.kgPerPcs,
                        line.basePrice,
                        line.totalPrice,
                        line.notes
                    ]
                );

                detailLogsToSave.push({
                    po_detail_id: newDet.insertId,
                    id_product: line.id_product,
                    old_qty: 0,
                    new_qty: line.qty,
                    old_base_qty: 0,
                    new_base_qty: line.baseQty,
                    old_total_price: 0,
                    new_total_price: line.totalPrice,
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
                link: '/po-list?search=' + encodeURIComponent(poData.po_number)
            });
        }

        res.json({ success: true, message: 'Purchase Order updated successfully!' });
    } catch (error) {
        await connection.rollback();
        if (error && error.isValidation) {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error('Error updating PO:', error);
        res.status(500).json({ success: false, message: 'Failed to update Purchase Order.', error: safeError(error) });
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
        const { reason } = req.body;
        const canceled_by = req.user.id;

        const [checkRows] = await connection.query(
            `SELECT h.po_number, h.status, h.customer_id, c.company_name 
             FROM sipuro_db.po_headers h
             LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id 
             WHERE h.po_header_id = ?`,
            [id]
        );
        if (checkRows.length === 0) return res.status(404).json({ success: false, message: 'PO not found.' });

        const poData = checkRows[0];
        if (Number(poData.customer_id) !== Number(req.user.customerId)) {
            return res.status(404).json({ success: false, message: 'PO not found.' });
        }
        // Memperbolehkan cancel jika status 'Draft' atau 'Waiting for Confirmation'
        if (!['Draft', 'Waiting for Confirmation'].includes(poData.status)) {
            return res.status(400).json({ success: false, message: 'PO cannot be canceled because of its current status.' });
        }

        const nowWib = getWibDateTimeString();

        await connection.beginTransaction();

        // 1. Update Header
        await connection.query(
            `UPDATE sipuro_db.po_headers SET status = 'Canceled', updated_by = ?, updated_at = ? WHERE po_header_id = ?`,
            [canceled_by || null, nowWib, id]
        );

        // 2. Ambil hanya baris detail yang masih aktif (deleted_at IS NULL)
        const [activeDetails] = await connection.query(
            `SELECT po_detail_id, id_product, qty, base_qty, total_price, status 
             FROM sipuro_db.po_details 
             WHERE po_header_id = ? AND deleted_at IS NULL`,
            [id]
        );

        // 3. Update status baris detail yang aktif menjadi 'Canceled' (tanpa mengisi deleted_at)
        if (activeDetails.length > 0) {
            await connection.query(
                `UPDATE sipuro_db.po_details SET status = 'Canceled' WHERE po_header_id = ? AND deleted_at IS NULL`,
                [id]
            );
        }

        // 4. Catat Log Audit Trail Header
        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId: id,
            actionType: 'CANCEL',
            oldStatus: poData.status,
            newStatus: 'Canceled',
            actionBy: canceled_by || poData.customer_id,
            reason: reason || null
        });

        // 5. Catat Log Audit Trail Detail
        if (activeDetails.length > 0) {
            const cancelDetailLogs = activeDetails.map(item => ({
                po_detail_id: item.po_detail_id,
                id_product: item.id_product,
                old_qty: item.qty,
                new_qty: item.qty,
                old_base_qty: item.base_qty,
                new_base_qty: item.base_qty,
                old_total_price: item.total_price,
                new_total_price: item.total_price,
                old_status: item.status || 'Active',
                new_status: 'Canceled'
            }));
            await logPODetails(connection, poHeaderLogId, cancelDetailLogs);
        }

        await connection.commit();

        // 6. Notifikasi ke PPIC (jika dipesan/dipublish sebelumnya)
        if (poData.status === 'Waiting for Confirmation') {
            await createNotification({
                title: 'PO Canceled',
                message: `${poData.po_number} has been canceled by ${poData.company_name || 'Customer'}.`,
                recipientType: 'EMPLOYEE',
                recipientDepartment: 'PPIC',
                senderType: 'CUSTOMER',
                senderId: canceled_by || poData.customer_id,
                link: '/po-list?search=' + encodeURIComponent(poData.po_number)
            });
        }

        res.json({ success: true, message: 'Purchase Order canceled successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error cancelling PO:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel Purchase Order.', error: safeError(error) });
    } finally {
        connection.release();
    }
};
