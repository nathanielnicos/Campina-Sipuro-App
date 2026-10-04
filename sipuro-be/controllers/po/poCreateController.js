const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');
const { logPOHeader, logPODetails } = require('../../helpers/poLogHelper');
const { getWibYear, getWibDateTimeString } = require('../../helpers/dateHelper');
const { calculateBaseQty } = require('../../helpers/poHelper');

/**
 * CREATE PO
 */
exports.createPO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { customer_id, created_by, delivery_address, description, items, status } = req.body;

        if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Incomplete request data.' });
        }

        const targetStatus = status || 'Waiting for Confirmation';
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

        // Menggunakan getWibYear() untuk penentuan tahun nomor PO berbasis WIB
        const currentYear = getWibYear();

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

        const productIds = items.map(item => item.id_product);
        const [productRows] = await sipuroDb.query(
            `SELECT id_product, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs FROM sipuro_db.products WHERE id_product IN (?)`,
            [productIds]
        );
        const productMap = new Map(productRows.map(p => [p.id_product, p]));

        // Dapatkan timestamp waktu WIB presisi untuk created_at & updated_at
        const nowWib = getWibDateTimeString();

        await connection.beginTransaction();

        // Insert Header dengan timestamp WIB eksplisit untuk created_at & updated_at
        const [headerResult] = await connection.query(
            `INSERT INTO sipuro_db.po_headers 
             (po_number, customer_id, subtotal, ppn_percent, total_amount, delivery_address, description, status, created_by, updated_by, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                poNumber,
                customer_id,
                subtotal,
                ppn_percent,
                total_amount,
                delivery_address || '',
                safeDescription,
                targetStatus,
                created_by || null,
                created_by || null,
                nowWib,
                nowWib
            ]
        );

        const poHeaderId = headerResult.insertId;
        const insertedDetails = [];

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
                 (po_header_id, id_product, qty, base_qty, uom, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs, base_price, total_price, status, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)`,
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
                new_total_price: totalPrice,
                old_status: null,
                new_status: 'Active'
            });
        }

        // Catat Audit Trail
        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId,
            actionType: 'CREATE',
            oldStatus: null,
            newStatus: targetStatus,
            actionBy: created_by || customer_id
        });

        await logPODetails(connection, poHeaderLogId, insertedDetails);

        await connection.commit();

        // Notifikasi ke PPIC HANYA jika bukan status Draft
        if (targetStatus !== 'Draft') {
            await createNotification({
                title: 'New PO Received',
                message: `${poNumber} has been created by ${customerName}.`,
                recipientType: 'EMPLOYEE',
                recipientDepartment: 'PPIC',
                senderType: 'CUSTOMER',
                senderId: customer_id,
                link: '/po-list?search=' + encodeURIComponent(poNumber)
            });
        }

        res.json({ success: true, message: 'Purchase Order created successfully!', data: { po_header_id: poHeaderId, po_number: poNumber } });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating PO:', error);
        res.status(500).json({ success: false, message: 'Failed to create Purchase Order.', error: error.message });
    } finally {
        connection.release();
    }
};
