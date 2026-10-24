const { sipuroDb } = require('../config/db');
const { hasAccess } = require('../middleware/auth');
const { safeError } = require('../helpers/safeError');
const { currentPriceCondition } = require('../helpers/po/currentPriceRules');

exports.getProducts = async (req, res) => {
    try {
        const query = `
            SELECT p.id_product, p.product_code, p.product_name, p.base_uom, p.pcs_per_ctn, p.ctn_per_plt, sp.price AS base_price
            FROM sipuro_db.products p
            JOIN sipuro_db.product_selling_prices sp ON p.id_product = sp.id_product
            WHERE p.is_active = 1 AND ${currentPriceCondition('sp')}
            ORDER BY p.product_name ASC
        `;
        const [rows] = await sipuroDb.query(query);

        // Harga hanya boleh dilihat oleh CUSTOMER; pengguna lain menerima data produk tanpa harga
        const data = hasAccess(req.user, 'CUSTOMER')
            ? rows
            : rows.map(({ base_price, ...productWithoutPrice }) => productWithoutPrice); // eslint-disable-line no-unused-vars

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch product data.', error: safeError(error) });
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
        res.status(500).json({ success: false, message: 'Failed to fetch company profile data.', error: safeError(error) });
    }
};

exports.getCustomerDetail = async (req, res) => {
    try {
        const requestedId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(requestedId) || requestedId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid customer id.' });
        }

        // Customer hanya boleh membaca data perusahaannya sendiri
        if (hasAccess(req.user, 'CUSTOMER') && req.user.customerId !== requestedId) {
            return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
        }

        const query = `SELECT customer_id, company_name, delivery_address FROM sipuro_db.customers WHERE customer_id = ?`;
        const [rows] = await sipuroDb.query(query, [requestedId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Customer not found.' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error fetching customer detail:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch customer details.', error: safeError(error) });
    }
};
