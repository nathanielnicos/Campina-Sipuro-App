const { sipuroDb } = require('../config/db');

/**
 * 1. Menarik seluruh daftar produk dari DB (Menu Master Produk)
 */
exports.getAllProducts = async (req, res) => {
    try {
        const query = `
            SELECT 
                id_product, 
                product_code, 
                product_name, 
                base_uom, 
                pcs_per_ctn, 
                ctn_per_plt, 
                is_active,
                created_at,
                updated_at
            FROM sipuro_db.products
            ORDER BY product_name ASC
        `;
        const [rows] = await sipuroDb.query(query);
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching all products:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data produk dari database.', error: error.message });
    }
};

/**
 * 2. Menarik seluruh riwayat harga produk dari DB (Menu Master Harga)
 */
exports.getAllPrices = async (req, res) => {
    try {
        const query = `
            SELECT 
                sp.id_price,
                p.product_code,
                p.product_name,
                sp.price,
                sp.start_date,
                sp.end_date,
                sp.created_at
            FROM sipuro_db.product_selling_prices sp
            JOIN sipuro_db.products p ON sp.id_product = p.id_product
            ORDER BY p.product_name ASC, sp.start_date DESC
        `;
        const [rows] = await sipuroDb.query(query);
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching all prices:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data harga dari database.', error: error.message });
    }
};

/**
 * 3. Menarik seluruh daftar karyawan dari DB (Menu Master Karyawan)
 */
exports.getAllEmployees = async (req, res) => {
    try {
        const query = `
            SELECT 
                employee_id,
                full_name,
                gender,
                department,
                join_date,
                is_suspended
            FROM sipuro_db.employees
            ORDER BY employee_id ASC
        `;
        const [rows] = await sipuroDb.query(query);
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching all employees:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data karyawan dari database.', error: error.message });
    }
};
