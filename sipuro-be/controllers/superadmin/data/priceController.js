const { sipuroDb } = require('../../../config/db');

/**
 * 1. Menarik riwayat harga produk dari DB (Server-side Pagination & Search)
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
        return res.status(500).json({ success: false, message: 'Failed to fetch price data from the database.', error: error.message });
    }
};
