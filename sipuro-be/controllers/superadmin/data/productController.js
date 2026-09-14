const { sipuroDb } = require('../../../config/db');

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
        return res.status(500).json({ success: false, message: 'Failed to fetch product data from the database.', error: error.message });
    }
};
