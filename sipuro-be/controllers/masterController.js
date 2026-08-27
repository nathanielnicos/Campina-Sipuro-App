const { sipuroDb } = require('../config/db');

exports.getProducts = async (req, res) => {
    try {
        const query = `
            SELECT p.id_product, p.product_code, p.product_name, p.base_uom, p.pcs_per_ctn, p.ctn_per_plt, sp.price AS base_price
            FROM sipuro_db.products p
            JOIN sipuro_db.product_selling_prices sp ON p.id_product = sp.id_product
            WHERE p.is_active = 1 AND sp.start_date <= CURDATE() AND (sp.end_date IS NULL OR sp.end_date >= CURDATE())
            ORDER BY p.product_name ASC
        `;
        const [rows] = await sipuroDb.query(query);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data produk', error: error.message });
    }
};

exports.getCompanyProfile = async (req, res) => {
    try {
        const query = `SELECT ppn_percent FROM sipuro_db.company_profile LIMIT 1`;
        const [rows] = await sipuroDb.query(query);
        if (rows.length === 0 || rows[0].ppn_percent === null) {
            return res.status(404).json({ success: false, message: 'Data PPN tidak ditemukan di company_profile.' });
        }
        res.json({ success: true, data: { ppn_percent: parseFloat(rows[0].ppn_percent) } });
    } catch (error) {
        console.error('Error fetching company profile:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data company profile', error: error.message });
    }
};

exports.getCustomerDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `SELECT customer_id, company_name, delivery_address FROM sipuro_db.customers WHERE customer_id = ?`;
        const [rows] = await sipuroDb.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Customer tidak ditemukan' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error fetching customer detail:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data customer', error: error.message });
    }
};
