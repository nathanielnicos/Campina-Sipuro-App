const { sipuroDb: db } = require('../../config/db');

// Mengambil daftar stok kelebihan produksi
exports.getUnallocatedStocks = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (page - 1) * limit;

        // Tangkap parameter query dari frontend
        const { searchStock, prodDate } = req.query;

        let whereClauses = ['us.qty_available > 0'];
        let queryParams = [];

        // Filter Pencarian (No Batch / Kode Produk / Nama Produk)
        if (searchStock && String(searchStock).trim() !== '') {
            whereClauses.push('(us.batch_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ?)');
            const keyword = `%${String(searchStock).trim()}%`;
            queryParams.push(keyword, keyword, keyword);
        }

        // Filter Tanggal Produksi
        if (prodDate && String(prodDate).trim() !== '') {
            whereClauses.push('DATE(us.production_date) = ?');
            queryParams.push(String(prodDate).trim());
        }

        const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

        // Query Count Total Items untuk Pagination
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM unallocated_stocks us
            LEFT JOIN products p ON us.id_product = p.id_product
            ${whereSql}
        `;
        const [countResult] = await db.query(countQuery, queryParams);
        const totalItems = Number(countResult[0]?.total || 0);

        // Query Data Paged (Aman: limit & offset menggunakan placeholder ?)
        const dataQuery = `
            SELECT 
                us.id,
                us.batch_number,
                us.id_product,
                us.qty_available,
                us.production_date,
                p.product_code,
                p.product_name
            FROM unallocated_stocks us
            LEFT JOIN products p ON us.id_product = p.id_product
            ${whereSql}
            ORDER BY us.production_date DESC, us.id DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(dataQuery, [...queryParams, limit, offset]);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit) || 1,
                totalItems,
                limit
            }
        });
    } catch (error) {
        console.error('Get Unallocated Stocks Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data stok lebihan.' });
    }
};
