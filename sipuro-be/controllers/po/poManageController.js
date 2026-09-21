const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');
const { logPOHeader, logPODetails } = require('../../helpers/poLogHelper');

/**
 * Helper untuk menghitung Base Qty (dalam PCS) berdasarkan UOM yang dipilih
 */
const calculateBaseQty = (qty, uom, product) => {
    const uppercaseUom = (uom || '').toUpperCase();
    const pcsPerCtn = product ? Number(product.pcs_per_ctn || 1) : 1;
    const ctnPerPlt = product ? Number(product.ctn_per_plt || 1) : 1;

    if (uppercaseUom === 'CTN') {
        return qty * pcsPerCtn;
    } else if (uppercaseUom === 'PLT') {
        return qty * pcsPerCtn * ctnPerPlt;
    }
    return qty;
};

/**
 * 1. CREATE PO
 */
exports.createPO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { customer_id, created_by, requested_delivery_date, delivery_address, description, items } = req.body;
        if (!customer_id || !requested_delivery_date || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Incomplete request data.' });
        }

        const safeDescription = description ? description.trim().slice(0, 50) : null;

        const [customerRows] = await sipuroDb.query(
            `SELECT company_name, customer_code FROM sipuro_db.customers WHERE customer_id = ?`,
            [customer_id]
        );
        const customerName = customerRows.length > 0 ? customerRows[0].company_name : 'Customer';
        const customerCode = (customerRows.length > 0 && customerRows[0].customer_code)
            ? customerRows[0].customer_code
            : 'CUST';

        const [profileRows] = await sipuroDb.query(`SELECT ppn_percent FROM sipuro_db.company_profile LIMIT 1`);
        const ppn_percent = profileRows.length > 0 && profileRows[0].ppn_percent !== null ? parseFloat(profileRows[0].ppn_percent) : 11;

        let subtotal = 0;
        items.forEach(item => {
            const itemPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            subtotal += (itemPrice * qty);
        });
        const total_amount = subtotal + (subtotal * (ppn_percent / 100));

        const currentYear = new Date().getFullYear();

        const [lastPoRows] = await sipuroDb.query(
            `SELECT po_number FROM sipuro_db.po_headers 
             WHERE YEAR(created_at) = ? 
             ORDER BY po_header_id DESC LIMIT 1`,
            [currentYear]
        );

        let nextSeq = 1;
        if (lastPoRows.length > 0 && lastPoRows[0].po_number) {
            const lastPoNumber = lastPoRows[0].po_number;
            const parts = lastPoNumber.split('/');
            const lastSeq = parseInt(parts[0], 10);
            if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
        }

        const formattedSeq = String(nextSeq).padStart(3, '0');
        const poNumber = `${formattedSeq}/PO/${customerCode}/${currentYear}`;

        // Ambil data konversi produk secara lengkap
        const productIds = items.map(item => item.id_product);
        const [productRows] = await sipuroDb.query(
            `SELECT id_product, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs FROM sipuro_db.products WHERE id_product IN (?)`,
            [productIds]
        );
        const productMap = new Map(productRows.map(p => [p.id_product, p]));

        await connection.beginTransaction();

        // Insert Header
        const [headerResult] = await connection.query(
            `INSERT INTO sipuro_db.po_headers (po_number, customer_id, subtotal, ppn_percent, total_amount, requested_delivery_date, delivery_address, description, status, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Waiting for Confirmation', ?, ?)`,
            [poNumber, customer_id, subtotal, ppn_percent, total_amount, requested_delivery_date, delivery_address || '', safeDescription, created_by || null, created_by || null]
        );

        const poHeaderId = headerResult.insertId;
        const insertedDetails = [];

        // Insert Details dengan snapshot konversi
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

            const [detailRes] = await connection.query(
                `INSERT INTO sipuro_db.po_details 
                 (po_header_id, id_product, qty, base_qty, uom, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs, base_price, total_price, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    poHeaderId,
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

            insertedDetails.push({
                po_detail_id: detailRes.insertId,
                id_product: item.id_product,
                old_qty: 0,
                new_qty: qty,
                old_base_qty: 0,
                new_base_qty: baseQty,
                old_total_price: 0,
                new_total_price: totalPrice
            });
        }

        // Catat Audit Trail LOG CREATE
        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId,
            actionType: 'CREATE',
            oldStatus: null,
            newStatus: 'Waiting for Confirmation',
            actionBy: created_by || customer_id
        });

        await logPODetails(connection, poHeaderLogId, insertedDetails);

        await connection.commit();

        await createNotification({
            title: 'New PO Received',
            message: `${poNumber} has been created by ${customerName}.`,
            recipientType: 'EMPLOYEE',
            recipientDepartment: 'PPIC',
            senderType: 'CUSTOMER',
            senderId: customer_id,
            link: '/po-list'
        });

        res.json({ success: true, message: 'Purchase Order created successfully!', data: { po_header_id: poHeaderId, po_number: poNumber } });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating PO:', error);
        res.status(500).json({ success: false, message: 'Failed to create Purchase Order.', error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * 2. UPDATE PO (REVISI QTY ITEM & KONVERSI)
 */
exports.updatePO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { id } = req.params;
        const { requested_delivery_date, delivery_address, description, items, updated_by } = req.body;

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
        if (poData.status !== 'Waiting for Confirmation') {
            return res.status(400).json({ success: false, message: 'PO cannot be updated because the status is not "Waiting for Confirmation".' });
        }

        // Fetch Data Eksisting untuk Pembanding Log
        const [existingDetails] = await connection.query(
            `SELECT po_detail_id, id_product, qty, base_qty, total_price FROM sipuro_db.po_details WHERE po_header_id = ? AND deleted_at IS NULL`,
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

        // Ambil data konversi produk secara lengkap
        const productIds = items.map(item => item.id_product);
        const [productRows] = await sipuroDb.query(
            `SELECT id_product, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs FROM sipuro_db.products WHERE id_product IN (?)`,
            [productIds]
        );
        const productMap = new Map(productRows.map(p => [p.id_product, p]));

        await connection.beginTransaction();

        // Update Header
        await connection.query(
            `UPDATE sipuro_db.po_headers SET subtotal = ?, ppn_percent = ?, total_amount = ?, requested_delivery_date = ?, delivery_address = ?, description = ?, updated_by = ? WHERE po_header_id = ?`,
            [subtotal, ppn_percent, total_amount, requested_delivery_date, delivery_address || '', safeDescription, updated_by || null, id]
        );

        const existingIds = existingDetails.map(row => row.po_detail_id);
        const payloadDetailIds = items.map(item => item.po_detail_id).filter(Boolean);

        // Soft Delete Item yang Dihapus
        const detailLogsToSave = [];
        const idsToDelete = existingIds.filter(detailId => !payloadDetailIds.includes(detailId));

        if (idsToDelete.length > 0) {
            await connection.query(`UPDATE sipuro_db.po_details SET deleted_at = NOW() WHERE po_detail_id IN (?)`, [idsToDelete]);
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
                    new_total_price: 0
                });
            }
        }

        // Loop Update/Insert Item Detail
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
                        new_total_price: totalPrice
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
                const [newDet] = await connection.query(
                    `INSERT INTO sipuro_db.po_details 
                     (po_header_id, id_product, qty, base_qty, uom, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs, base_price, total_price, notes) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                    new_total_price: totalPrice
                });
            }
        }

        // Catat Audit Trail UPDATE_QTY
        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId: id,
            actionType: 'UPDATE_QTY',
            oldStatus: poData.status,
            newStatus: poData.status,
            actionBy: updated_by || poData.customer_id
        });

        await logPODetails(connection, poHeaderLogId, detailLogsToSave);

        await connection.commit();

        await createNotification({
            title: 'PO Updated',
            message: `${poData.po_number} has been updated by ${poData.company_name || 'Customer'}.`,
            recipientType: 'EMPLOYEE',
            recipientDepartment: 'PPIC',
            senderType: 'CUSTOMER',
            senderId: updated_by || poData.customer_id,
            link: '/po-list'
        });

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
 * 3. CANCEL PO
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
        if (poData.status !== 'Waiting for Confirmation') {
            return res.status(400).json({ success: false, message: 'PO cannot be canceled because the status is not "Waiting for Confirmation".' });
        }

        await connection.beginTransaction();

        await connection.query(`UPDATE sipuro_db.po_headers SET status = 'Canceled', updated_by = ? WHERE po_header_id = ?`, [canceled_by || null, id]);

        // Catat Audit Trail CANCEL
        await logPOHeader(connection, {
            poHeaderId: id,
            actionType: 'CANCEL',
            oldStatus: poData.status,
            newStatus: 'Canceled',
            actionBy: canceled_by || poData.customer_id,
            reason: reason || null
        });

        await connection.commit();

        await createNotification({
            title: 'PO Canceled',
            message: `${poData.po_number} has been canceled by ${poData.company_name || 'Customer'}.`,
            recipientType: 'EMPLOYEE',
            recipientDepartment: 'PPIC',
            senderType: 'CUSTOMER',
            senderId: canceled_by || poData.customer_id,
            link: '/po-list'
        });

        res.json({ success: true, message: 'Purchase Order canceled successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error cancelling PO:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel Purchase Order.', error: error.message });
    } finally {
        connection.release();
    }
};

/**
 * 4. APPROVE / REJECT PO (UPDATE STATUS)
 */
exports.updatePOStatus = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { id } = req.params;
        const { status, notes, updated_by } = req.body;
        if (!status) return res.status(400).json({ success: false, message: 'Status is required.' });

        const safeNotes = notes ? notes.trim().slice(0, 50) : null;

        if (status === 'Rejected' && !safeNotes) {
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

        await connection.query(
            `UPDATE sipuro_db.po_headers 
             SET status = ?, rejection_reason = ?, confirmed_by = ?, confirmed_at = NOW() 
             WHERE po_header_id = ?`,
            [status, safeNotes, updated_by || null, id]
        );

        // Catat Audit Trail APPROVE/REJECT
        await logPOHeader(connection, {
            poHeaderId: id,
            actionType,
            oldStatus: targetPo.status,
            newStatus: status,
            actionBy: updated_by || null,
            reason: safeNotes
        });

        await connection.commit();

        const isApproved = status === 'Approved';
        const notifTitle = isApproved ? 'PO Approved' : 'PO Rejected';
        const actionText = isApproved ? 'approved' : 'rejected';

        await createNotification({
            title: notifTitle,
            message: `${targetPo.po_number} has been ${actionText} by PPIC.${safeNotes ? ` Notes: ${safeNotes}` : ''}`,
            recipientType: 'CUSTOMER',
            recipientId: targetPo.customer_id,
            senderType: 'EMPLOYEE',
            senderId: updated_by || null,
            link: '/po-list'
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
