const { sipuroDb } = require('../config/db');

/**
 * 1. Menarik daftar produk dari DB (Server-side Pagination & Search)
 */
exports.getAllProducts = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        const conditions = [];
        const queryParams = [];

        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            conditions.push('(product_code LIKE ? OR product_name LIKE ?)');
            queryParams.push(searchTerm, searchTerm);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*) AS total FROM sipuro_db.products ${whereClause}`;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = countRows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum);

        const query = `
            SELECT 
                id_product, 
                product_code, 
                product_name, 
                base_uom, 
                pcs_per_ctn, 
                ctn_per_plt, 
                ml_per_pcs,
                kg_per_pcs,
                is_active,
                created_at
            FROM sipuro_db.products
            ${whereClause}
            ORDER BY product_name ASC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await sipuroDb.query(query, [...queryParams, limitNum, offset]);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data produk dari database.', error: error.message });
    }
};

/**
 * 2. Menarik riwayat harga produk dari DB (Server-side Pagination & Search)
 */
exports.getAllPrices = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        const conditions = [];
        const queryParams = [];

        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            conditions.push('(p.product_code LIKE ? OR p.product_name LIKE ?)');
            queryParams.push(searchTerm, searchTerm);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `
            SELECT COUNT(*) AS total 
            FROM sipuro_db.product_selling_prices sp
            JOIN sipuro_db.products p ON sp.id_product = p.id_product
            ${whereClause}
        `;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = countRows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum);

        const query = `
            SELECT 
                sp.price_id,
                p.product_code,
                p.product_name,
                sp.price,
                sp.start_date,
                sp.end_date,
                sp.created_at
            FROM sipuro_db.product_selling_prices sp
            JOIN sipuro_db.products p ON sp.id_product = p.id_product
            ${whereClause}
            ORDER BY p.product_name ASC, sp.start_date DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await sipuroDb.query(query, [...queryParams, limitNum, offset]);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching prices:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data harga dari database.', error: error.message });
    }
};

/**
 * 3. Menarik daftar karyawan dari DB (Server-side Pagination & Search)
 */
exports.getAllEmployees = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        const conditions = [];
        const queryParams = [];

        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            conditions.push('(employee_code LIKE ? OR full_name LIKE ?)');
            queryParams.push(searchTerm, searchTerm);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*) AS total FROM sipuro_db.employees ${whereClause}`;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = countRows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum);

        const query = `
            SELECT 
                id,
                employee_code,
                full_name,
                gender,
                department,
                birth_date,
                is_suspended
            FROM sipuro_db.employees
            ${whereClause}
            ORDER BY employee_code ASC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await sipuroDb.query(query, [...queryParams, limitNum, offset]);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data karyawan dari database.', error: error.message });
    }
};

/**
 * Toggle Status Suspend Karyawan
 */
exports.toggleEmployeeStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_suspended } = req.body;

        if (is_suspended === undefined) {
            return res.status(400).json({ success: false, message: 'Status is_suspended wajib diisi.' });
        }

        await sipuroDb.query(
            'UPDATE sipuro_db.employees SET is_suspended = ? WHERE id = ?',
            [is_suspended ? 1 : 0, id]
        );

        return res.json({
            success: true,
            message: `Status karyawan berhasil diubah.`
        });
    } catch (error) {
        console.error('Error toggling employee status:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengubah status karyawan.', error: error.message });
    }
};

/**
 * 4. Menarik daftar customer dari DB (Server-side Pagination & Search)
 */
exports.getAllCustomers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        const conditions = [];
        const queryParams = [];

        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            conditions.push('(customer_code LIKE ? OR company_name LIKE ?)');
            queryParams.push(searchTerm, searchTerm);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*) AS total FROM sipuro_db.customers ${whereClause}`;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = countRows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum);

        const query = `
            SELECT 
                customer_id,
                customer_code,
                company_name,
                email,
                phone,
                address,
                delivery_address,
                is_active,
                created_at
            FROM sipuro_db.customers
            ${whereClause}
            ORDER BY customer_code ASC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await sipuroDb.query(query, [...queryParams, limitNum, offset]);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching customers:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data pelanggan dari database.', error: error.message });
    }
};

/**
 * Toggle Status Aktif Customer
 */
exports.toggleCustomerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (is_active === undefined) {
            return res.status(400).json({ success: false, message: 'Status is_active wajib diisi.' });
        }

        await sipuroDb.query(
            'UPDATE sipuro_db.customers SET is_active = ? WHERE customer_id = ?',
            [is_active ? 1 : 0, id]
        );

        return res.json({
            success: true,
            message: `Status pelanggan berhasil diubah.`
        });
    } catch (error) {
        console.error('Error toggling customer status:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengubah status pelanggan.', error: error.message });
    }
};
