const { sipuroDb, campinaDb } = require('../config/db');

exports.getPOList = async (req, res) => {
    try {
        const { customer_id } = req.query;
        let whereClause = '';
        const queryParams = [];

        if (customer_id && customer_id !== 'null' && customer_id !== 'undefined') {
            whereClause = 'WHERE h.customer_id = ?';
            queryParams.push(customer_id);
        }

        const query = `
            SELECT h.po_header_id, h.po_number, h.created_at, h.requested_delivery_date, h.total_amount, h.status, c.company_name, COUNT(d.po_detail_id) AS total_items
            FROM sipuro_db.po_headers h
            LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id
            LEFT JOIN sipuro_db.po_details d ON h.po_header_id = d.po_header_id AND d.deleted_at IS NULL
            ${whereClause}
            GROUP BY h.po_header_id
            ORDER BY h.created_at DESC
        `;
        const [rows] = await sipuroDb.query(query, queryParams);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching PO list:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data Purchase Order', error: error.message });
    }
};

exports.getPODetail = async (req, res) => {
    try {
        const { id } = req.params;
        const headerQuery = `
            SELECT h.*, c.company_name
            FROM sipuro_db.po_headers h
            LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id
            WHERE h.po_header_id = ?
        `;
        const [headerRows] = await sipuroDb.query(headerQuery, [id]);
        if (headerRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Data PO tidak ditemukan.' });
        }

        const detailQuery = `
            SELECT d.*, p.product_code, p.product_name, p.base_uom, p.pcs_per_ctn, p.ctn_per_plt
            FROM sipuro_db.po_details d
            JOIN campina_db.products p ON d.id_product = p.id_product
            WHERE d.po_header_id = ? AND d.deleted_at IS NULL
        `;
        const [detailRows] = await sipuroDb.query(detailQuery, [id]);

        res.json({ success: true, data: { header: headerRows[0], items: detailRows } });
    } catch (error) {
        console.error('Error fetching PO detail:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil detail PO', error: error.message });
    }
};

// Fungsi pembantu untuk mengalkulasi base_qty secara otomatis berdasarkan UOM
const calculateBaseQty = (qty, uom, product) => {
    const uppercaseUom = (uom || '').toUpperCase();
    const pcsPerCtn = product ? Number(product.pcs_per_ctn || 1) : 1;
    const ctnPerPlt = product ? Number(product.ctn_per_plt || 1) : 1;

    if (uppercaseUom === 'CTN') {
        return qty * pcsPerCtn;
    } else if (uppercaseUom === 'PLT') {
        return qty * pcsPerCtn * ctnPerPlt;
    }
    return qty; // Jika UOM sudah dalam Base UOM (seperti PCS)
};

exports.createPO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { customer_id, requested_delivery_date, delivery_address, description, items } = req.body;
        if (!customer_id || !requested_delivery_date || !items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });
        }

        const [profileRows] = await campinaDb.query(`SELECT ppn_percent FROM campina_db.company_profile LIMIT 1`);
        const ppn_percent = profileRows.length > 0 && profileRows[0].ppn_percent !== null ? parseFloat(profileRows[0].ppn_percent) : 11;

        let subtotal = 0;
        items.forEach(item => {
            const itemPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            subtotal += (itemPrice * qty);
        });
        const total_amount = subtotal + (subtotal * (ppn_percent / 100));

        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const poNumber = `PO-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;

        // Ambil data konversi produk sekaligus
        const productIds = items.map(item => item.id_product);
        const [productRows] = await campinaDb.query(
            `SELECT id_product, pcs_per_ctn, ctn_per_plt FROM campina_db.products WHERE id_product IN (?)`,
            [productIds]
        );
        const productMap = new Map(productRows.map(p => [p.id_product, p]));

        await connection.beginTransaction();

        const [headerResult] = await connection.query(
            `INSERT INTO sipuro_db.po_headers (po_number, customer_id, subtotal, ppn_percent, total_amount, requested_delivery_date, delivery_address, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Waiting for Confirmation')`,
            [poNumber, customer_id, subtotal, ppn_percent, total_amount, requested_delivery_date, delivery_address || '', description || null]
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
        const { requested_delivery_date, delivery_address, description, items } = req.body;

        const [checkRows] = await connection.query(`SELECT status FROM sipuro_db.po_headers WHERE po_header_id = ?`, [id]);
        if (checkRows.length === 0) return res.status(404).json({ success: false, message: 'PO tidak ditemukan.' });
        if (checkRows[0].status !== 'Waiting for Confirmation') {
            return res.status(400).json({ success: false, message: 'PO tidak dapat diubah karena status bukan "Waiting for Confirmation".' });
        }

        const [profileRows] = await campinaDb.query(`SELECT ppn_percent FROM campina_db.company_profile LIMIT 1`);
        const ppn_percent = profileRows.length > 0 && profileRows[0].ppn_percent !== null ? parseFloat(profileRows[0].ppn_percent) : 11;

        let subtotal = 0;
        items.forEach(item => {
            const itemPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            subtotal += (itemPrice * qty);
        });
        const total_amount = subtotal + (subtotal * (ppn_percent / 100));

        // Ambil data konversi produk sekaligus
        const productIds = items.map(item => item.id_product);
        const [productRows] = await campinaDb.query(
            `SELECT id_product, pcs_per_ctn, ctn_per_plt FROM campina_db.products WHERE id_product IN (?)`,
            [productIds]
        );
        const productMap = new Map(productRows.map(p => [p.id_product, p]));

        await connection.beginTransaction();

        await connection.query(
            `UPDATE sipuro_db.po_headers SET subtotal = ?, ppn_percent = ?, total_amount = ?, requested_delivery_date = ?, delivery_address = ?, description = ? WHERE po_header_id = ?`,
            [subtotal, ppn_percent, total_amount, requested_delivery_date, delivery_address || '', description || null, id]
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
        const [checkRows] = await sipuroDb.query(`SELECT status FROM sipuro_db.po_headers WHERE po_header_id = ?`, [id]);
        if (checkRows.length === 0) return res.status(404).json({ success: false, message: 'PO tidak ditemukan.' });
        if (checkRows[0].status !== 'Waiting for Confirmation') {
            return res.status(400).json({ success: false, message: 'PO tidak dapat dibatalkan karena status bukan "Waiting for Confirmation".' });
        }

        await sipuroDb.query(`UPDATE sipuro_db.po_headers SET status = 'Canceled' WHERE po_header_id = ?`, [id]);
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

        const query = `
            UPDATE sipuro_db.po_headers 
            SET status = ?, rejection_reason = ?, confirmed_by = ?, confirmed_at = NOW() 
            WHERE po_header_id = ?
        `;
        const [result] = await sipuroDb.query(query, [status, notes || null, updated_by || null, id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Data PO tidak ditemukan.' });

        res.json({ success: true, message: `Status PO berhasil diperbarui menjadi ${status}.` });
    } catch (error) {
        console.error('Error updating PO status:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui status PO.', error: error.message });
    }
};
