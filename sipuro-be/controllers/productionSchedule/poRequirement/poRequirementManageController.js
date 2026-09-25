const { sipuroDb } = require('../../../config/db');
const { logPOHeader, logPODetails } = require('../../../helpers/poLogHelper');
const { getWibYear, getWibDateTimeString } = require('../../../helpers/dateHelper');

/**
 * CREATE DRAFT PO FROM PO REQUIREMENT
 */
exports.createDraftPO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { customer_id, created_by, items, description } = req.body;

        if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Customer and items are required.' });
        }

        // 1. Ambil customer_code dan delivery_address dari tabel customers
        const [customerRows] = await connection.query(
            `SELECT customer_code, delivery_address FROM sipuro_db.customers WHERE customer_id = ?`,
            [customer_id]
        );
        if (customerRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }
        const customerCode = customerRows[0].customer_code || 'CUST';
        const deliveryAddress = customerRows[0].delivery_address || '';

        // 2. Ambil PPN Percent dari Company Profile
        const [profileRows] = await connection.query(`SELECT ppn_percent FROM sipuro_db.company_profile LIMIT 1`);
        const ppn_percent = profileRows.length > 0 && profileRows[0].ppn_percent !== null ? parseFloat(profileRows[0].ppn_percent) : 11;

        // 3. Ambil data produk & harga jual terkini
        const productIds = items.map(i => i.id_product);
        const [productsData] = await connection.query(
            `SELECT 
                p.id_product, 
                p.base_uom, 
                p.pcs_per_ctn, 
                p.ctn_per_plt, 
                p.ml_per_pcs, 
                p.kg_per_pcs,
                COALESCE(sp.price, 0) AS unit_price
             FROM sipuro_db.products p
             LEFT JOIN sipuro_db.product_selling_prices sp ON sp.id_product = p.id_product
             WHERE p.id_product IN (?)`,
            [productIds]
        );

        const productMap = new Map(productsData.map(p => [p.id_product, p]));

        // 4. Hitung Subtotal & Nominal
        let subtotal = 0;
        const processedItems = [];

        for (const item of items) {
            const product = productMap.get(item.id_product);
            if (!product) continue;

            const qty = parseInt(item.required_po_qty, 10) || 0;
            if (qty <= 0) continue;

            const basePrice = parseFloat(product.unit_price) || 0;
            const totalPrice = qty * basePrice;

            subtotal += totalPrice;

            processedItems.push({
                id_product: item.id_product,
                qty: qty,
                base_qty: qty,
                uom: product.base_uom || 'PCS',
                pcs_per_ctn: Number(product.pcs_per_ctn || 1),
                ctn_per_plt: Number(product.ctn_per_plt || 1),
                ml_per_pcs: product.ml_per_pcs,
                kg_per_pcs: product.kg_per_pcs,
                base_price: basePrice,
                total_price: totalPrice
            });
        }

        if (processedItems.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid items with quantity > 0.' });
        }

        const total_amount = subtotal + (subtotal * (ppn_percent / 100));

        // 5. Generate Nomor PO (Menggunakan Tahun Presisi WIB)
        const currentYear = getWibYear();
        const [lastPoRows] = await connection.query(
            `SELECT po_number FROM sipuro_db.po_headers 
             WHERE YEAR(created_at) = ? 
             ORDER BY po_header_id DESC LIMIT 1`,
            [currentYear]
        );

        let nextSeq = 1;
        if (lastPoRows.length > 0 && lastPoRows[0].po_number) {
            const parts = lastPoRows[0].po_number.split('/');
            const lastSeq = parseInt(parts[0], 10);
            if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
        }

        const formattedSeq = String(nextSeq).padStart(3, '0');
        const poNumber = `${formattedSeq}/PO/${customerCode}/${currentYear}`;

        await connection.beginTransaction();

        // 6. Insert PO Header (Eksplisit menyertakan timestamp WIB untuk created_at & updated_at)
        const nowWib = getWibDateTimeString();
        const [headerResult] = await connection.query(
            `INSERT INTO sipuro_db.po_headers 
            (po_number, customer_id, subtotal, ppn_percent, total_amount, delivery_address, description, status, created_by, updated_by, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?)`,
            [
                poNumber,
                customer_id,
                subtotal,
                ppn_percent,
                total_amount,
                deliveryAddress,
                description || null,
                created_by || null,
                created_by || null,
                nowWib,
                nowWib
            ]
        );

        const poHeaderId = headerResult.insertId;
        const insertedDetails = [];

        // 7. Insert PO Details
        for (const item of processedItems) {
            const [detailRes] = await connection.query(
                `INSERT INTO sipuro_db.po_details 
                 (po_header_id, id_product, qty, base_qty, uom, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs, base_price, total_price, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    poHeaderId,
                    item.id_product,
                    item.qty,
                    item.base_qty,
                    item.uom,
                    item.pcs_per_ctn,
                    item.ctn_per_plt,
                    item.ml_per_pcs,
                    item.kg_per_pcs,
                    item.base_price,
                    item.total_price,
                    nowWib,
                    nowWib
                ]
            );

            insertedDetails.push({
                po_detail_id: detailRes.insertId,
                id_product: item.id_product,
                old_qty: 0,
                new_qty: item.qty,
                old_base_qty: 0,
                new_base_qty: item.base_qty,
                old_total_price: 0,
                new_total_price: item.total_price
            });
        }

        // 8. Log Audit Trail
        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId,
            actionType: 'CREATE',
            oldStatus: null,
            newStatus: 'Draft',
            actionBy: created_by || null
        });

        await logPODetails(connection, poHeaderLogId, insertedDetails);

        await connection.commit();

        res.json({
            success: true,
            message: `Draft PO ${poNumber} successfully created!`,
            data: { po_header_id: poHeaderId, po_number: poNumber }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating Draft PO:', error);
        res.status(500).json({ success: false, message: 'Failed to create Draft PO.', error: error.message });
    } finally {
        connection.release();
    }
};
