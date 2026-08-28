const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');

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

exports.createPO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { customer_id, requested_delivery_date, delivery_address, description, items } = req.body;
        if (!customer_id || !requested_delivery_date || !items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });
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

            if (!isNaN(lastSeq)) {
                nextSeq = lastSeq + 1;
            }
        }

        const formattedSeq = String(nextSeq).padStart(3, '0');
        const poNumber = `${formattedSeq}/PO/${customerCode}/${currentYear}`;

        const productIds = items.map(item => item.id_product);
        const [productRows] = await sipuroDb.query(
            `SELECT id_product, pcs_per_ctn, ctn_per_plt FROM sipuro_db.products WHERE id_product IN (?)`,
            [productIds]
        );
        const productMap = new Map(productRows.map(p => [p.id_product, p]));

        await connection.beginTransaction();

        const [headerResult] = await connection.query(
            `INSERT INTO sipuro_db.po_headers (po_number, customer_id, subtotal, ppn_percent, total_amount, requested_delivery_date, delivery_address, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Waiting for Confirmation')`,
            [poNumber, customer_id, subtotal, ppn_percent, total_amount, requested_delivery_date, delivery_address || '', safeDescription]
        );

        const poHeaderId = headerResult.insertId;
        const detailValues = items.map(item => {
            const unitPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            const totalPrice = item.total_price !== undefined ? parseFloat(item.total_price) : (unitPrice * qty);
            const selectedUom = item.selected_uom || item.uom || item.base_uom || 'PCS';

            const product = productMap.get(item.id_product);
            const baseQty = calculateBaseQty(qty, selectedUom, product);

            return [poHeaderId, item.id_product, qty, baseQty, selectedUom, unitPrice, totalPrice, item.notes || null];
        });

        await connection.query(
            `INSERT INTO sipuro_db.po_details (po_header_id, id_product, qty, base_qty, uom, base_price, total_price, notes) VALUES ?`,
            [detailValues]
        );

        await connection.commit();

        await createNotification({
            title: 'PO Baru Masuk',
            message: `${poNumber} telah dibuat oleh ${customerName}.`,
            recipientType: 'EMPLOYEE',
            recipientDepartment: 'PPIC',
            senderType: 'CUSTOMER',
            senderId: customer_id,
            link: '/po-list'
        });

        res.json({ success: true, message: 'Purchase Order berhasil dibuat!', data: { po_header_id: poHeaderId, po_number: poNumber } });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating PO:', error);
        res.status(500).json({ success: false, message: 'Gagal membuat Purchase Order', error: error.message });
    } finally {
        connection.release();
    }
};

exports.updatePO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { id } = req.params;
        const { requested_delivery_date, delivery_address, description, items, updated_by } = req.body;

        const safeDescription = description ? description.trim().slice(0, 50) : null;

        const [checkRows] = await connection.query(
            `SELECT h.po_number, h.status, h.customer_id, c.company_name 
             FROM sipuro_db.po_headers h
             LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id 
             WHERE h.po_header_id = ?`,
            [id]
        );
        if (checkRows.length === 0) return res.status(404).json({ success: false, message: 'PO tidak ditemukan.' });

        const poData = checkRows[0];
        if (poData.status !== 'Waiting for Confirmation') {
            return res.status(400).json({ success: false, message: 'PO tidak dapat diubah karena status bukan "Waiting for Confirmation".' });
        }

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
            `SELECT id_product, pcs_per_ctn, ctn_per_plt FROM sipuro_db.products WHERE id_product IN (?)`,
            [productIds]
        );
        const productMap = new Map(productRows.map(p => [p.id_product, p]));

        await connection.beginTransaction();

        await connection.query(
            `UPDATE sipuro_db.po_headers SET subtotal = ?, ppn_percent = ?, total_amount = ?, requested_delivery_date = ?, delivery_address = ?, description = ? WHERE po_header_id = ?`,
            [subtotal, ppn_percent, total_amount, requested_delivery_date, delivery_address || '', safeDescription, id]
        );

        const [existingDetails] = await connection.query(`SELECT po_detail_id FROM sipuro_db.po_details WHERE po_header_id = ? AND deleted_at IS NULL`, [id]);
        const existingIds = existingDetails.map(row => row.po_detail_id);
        const payloadDetailIds = items.map(item => item.po_detail_id).filter(Boolean);

        const idsToDelete = existingIds.filter(detailId => !payloadDetailIds.includes(detailId));
        if (idsToDelete.length > 0) {
            await connection.query(`UPDATE sipuro_db.po_details SET deleted_at = NOW() WHERE po_detail_id IN (?)`, [idsToDelete]);
        }

        for (const item of items) {
            const unitPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            const totalPrice = item.total_price !== undefined ? parseFloat(item.total_price) : (unitPrice * qty);
            const selectedUom = item.selected_uom || item.uom || item.base_uom || 'PCS';

            const product = productMap.get(item.id_product);
            const baseQty = calculateBaseQty(qty, selectedUom, product);

            if (item.po_detail_id && existingIds.includes(item.po_detail_id)) {
                await connection.query(
                    `UPDATE sipuro_db.po_details SET id_product = ?, qty = ?, base_qty = ?, uom = ?, base_price = ?, total_price = ?, notes = ? WHERE po_detail_id = ?`,
                    [item.id_product, qty, baseQty, selectedUom, unitPrice, totalPrice, item.notes || null, item.po_detail_id]
                );
            } else {
                await connection.query(
                    `INSERT INTO sipuro_db.po_details (po_header_id, id_product, qty, base_qty, uom, base_price, total_price, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [id, item.id_product, qty, baseQty, selectedUom, unitPrice, totalPrice, item.notes || null]
                );
            }
        }

        await connection.commit();

        await createNotification({
            title: 'PO Diperbarui',
            message: `${poData.po_number} telah diperbarui oleh ${poData.company_name || 'Customer'}.`,
            recipientType: 'EMPLOYEE',
            recipientDepartment: 'PPIC',
            senderType: 'CUSTOMER',
            senderId: updated_by || poData.customer_id,
            link: '/po-list'
        });

        res.json({ success: true, message: 'Purchase Order berhasil diperbarui!' });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating PO:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui Purchase Order', error: error.message });
    } finally {
        connection.release();
    }
};

exports.cancelPO = async (req, res) => {
    try {
        const { id } = req.params;
        const { canceled_by } = req.body;

        const [checkRows] = await sipuroDb.query(
            `SELECT h.po_number, h.status, h.customer_id, c.company_name 
             FROM sipuro_db.po_headers h
             LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id 
             WHERE h.po_header_id = ?`,
            [id]
        );
        if (checkRows.length === 0) return res.status(404).json({ success: false, message: 'PO tidak ditemukan.' });

        const poData = checkRows[0];
        if (poData.status !== 'Waiting for Confirmation') {
            return res.status(400).json({ success: false, message: 'PO tidak dapat dibatalkan karena status bukan "Waiting for Confirmation".' });
        }

        await sipuroDb.query(`UPDATE sipuro_db.po_headers SET status = 'Canceled' WHERE po_header_id = ?`, [id]);

        await createNotification({
            title: 'PO Dibatalkan',
            message: `${poData.po_number} telah dibatalkan oleh ${poData.company_name || 'Customer'}.`,
            recipientType: 'EMPLOYEE',
            recipientDepartment: 'PPIC',
            senderType: 'CUSTOMER',
            senderId: canceled_by || poData.customer_id,
            link: '/po-list'
        });

        res.json({ success: true, message: 'Purchase Order berhasil dibatalkan.' });
    } catch (error) {
        console.error('Error cancelling PO:', error);
        res.status(500).json({ success: false, message: 'Gagal membatalkan Purchase Order', error: error.message });
    }
};

exports.updatePOStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, updated_by } = req.body;
        if (!status) return res.status(400).json({ success: false, message: 'Status wajib diisi.' });

        const safeNotes = notes ? notes.trim().slice(0, 50) : null;

        if (status === 'Rejected' && !safeNotes) {
            return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi (maksimal 50 karakter).' });
        }

        const [poRows] = await sipuroDb.query(
            `SELECT po_number, customer_id FROM sipuro_db.po_headers WHERE po_header_id = ?`,
            [id]
        );

        if (poRows.length === 0) return res.status(404).json({ success: false, message: 'Data PO tidak ditemukan.' });

        const targetPo = poRows[0];

        const query = `
            UPDATE sipuro_db.po_headers 
            SET status = ?, rejection_reason = ?, confirmed_by = ?, confirmed_at = NOW() 
            WHERE po_header_id = ?
        `;
        await sipuroDb.query(query, [status, safeNotes, updated_by || null, id]);

        const isApproved = status === 'Waiting Batch Assignment';
        const notifTitle = isApproved ? 'PO Diterima' : 'PO Ditolak';
        const actionText = isApproved ? 'diterima' : 'ditolak';

        await createNotification({
            title: notifTitle,
            message: `${targetPo.po_number} telah ${actionText} oleh PPIC.${safeNotes ? ` Catatan: ${safeNotes}` : ''}`,
            recipientType: 'CUSTOMER',
            recipientId: targetPo.customer_id,
            senderType: 'EMPLOYEE',
            senderId: updated_by || null,
            link: '/po-list'
        });

        res.json({ success: true, message: `Status PO berhasil diperbarui menjadi ${status}.` });
    } catch (error) {
        console.error('Error updating PO status:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui status PO.', error: error.message });
    }
};
