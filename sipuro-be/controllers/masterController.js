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
        res.status(500).json({ success: false, message: 'Failed to fetch product data.', error: error.message });
    }
};

exports.getCompanyProfile = async (req, res) => {
    try {
        const query = `SELECT company_name, address, email, phone, ppn_percent FROM sipuro_db.company_profile LIMIT 1`;
        const [rows] = await sipuroDb.query(query);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Company profile data not found.' });
        }

        const profile = rows[0];
        res.json({
            success: true,
            data: {
                company_name: profile.company_name,
                address: profile.address,
                email: profile.email,
                phone: profile.phone,
                ppn_percent: profile.ppn_percent !== null ? parseFloat(profile.ppn_percent) : 0
            }
        });
    } catch (error) {
        console.error('Error fetching company profile:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch company profile data.', error: error.message });
    }
};

exports.getCustomerDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `SELECT customer_id, company_name, delivery_address FROM sipuro_db.customers WHERE customer_id = ?`;
        const [rows] = await sipuroDb.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error fetching customer detail:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch customer details.', error: error.message });
    }
};
