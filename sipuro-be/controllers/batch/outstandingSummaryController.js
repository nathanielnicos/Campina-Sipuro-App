const { sipuroDb } = require('../../config/db');
const { getPOTolerance } = require('../../helpers/batchHelper');

/**
 * Mengambil daftar produk dan PO terkait yang masih outstanding (belum terpenuhi sesuai toleransi PO)
 */
exports.getOutstandingSummary = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const {
            searchProduct,
            searchPo,
            fromCreatedDate,
            toCreatedDate,
            fromDeliveryDate,
            toDeliveryDate,
            sortKey,
            sortOrder
        } = req.query;

        // Ambil toleransi PO
        const poTolerance = await getPOTolerance(sipuroDb);

        // Rumus kondisi outstanding & filter hanya PO berstatus Approved
        let whereClauses = [
            `d.deleted_at IS NULL`,
            `h.status = 'Approved'`,
            `d.fulfilled_qty < (d.base_qty * ?)`
        ];
        let queryParams = [poTolerance];

        if (searchProduct) {
            whereClauses.push(`(p.product_code LIKE ? OR p.product_name LIKE ?)`);
            queryParams.push(`%${searchProduct}%`, `%${searchProduct}%`);
        }

        if (searchPo) {
            whereClauses.push(`h.po_number LIKE ?`);
            queryParams.push(`%${searchPo}%`);
        }

        if (fromCreatedDate) {
            whereClauses.push(`DATE(h.created_at) >= ?`);
            queryParams.push(fromCreatedDate);
        }

        if (toCreatedDate) {
            whereClauses.push(`DATE(h.created_at) <= ?`);
            queryParams.push(toCreatedDate);
        }

        if (fromDeliveryDate) {
            whereClauses.push(`DATE(h.requested_delivery_date) >= ?`);
            queryParams.push(fromDeliveryDate);
        }

        if (toDeliveryDate) {
            whereClauses.push(`DATE(h.requested_delivery_date) <= ?`);
            queryParams.push(toDeliveryDate);
        }

        const whereSql = whereClauses.join(' AND ');

        // Mapping aman untuk ORDER BY (Mencegah SQL Injection)
        const allowedSortKeys = {
            product_code: 'p.product_code',
            product_name: 'p.product_name',
            total_required_qty: 'total_required_qty',
            total_remaining_qty: 'total_remaining_qty',
            total_po_count: 'total_po_count'
        };

        const targetSortColumn = allowedSortKeys[sortKey] || 'p.product_code';
        const targetSortOrder = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        const orderBySql = `ORDER BY ${targetSortColumn} ${targetSortOrder}`;

        // Query menghitung total SKU
        const countQuery = `
            SELECT COUNT(*) AS total FROM (
                SELECT p.id_product
                FROM sipuro_db.po_details d
                JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
                JOIN sipuro_db.products p ON d.id_product = p.id_product
                WHERE ${whereSql}
                GROUP BY p.id_product
            ) sub;
        `;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = Number(countRows[0]?.total || 0);
        const totalPages = Math.ceil(totalItems / limitNum);

        // Query mengambil data outstanding per produk dan rincian PO
        const query = `
            SELECT 
                p.id_product,
                p.product_code,
                p.product_name,
                p.base_uom,
                SUM(d.base_qty) AS total_required_qty,
                SUM(GREATEST(0, d.base_qty - d.fulfilled_qty)) AS total_remaining_qty,
                COUNT(DISTINCT h.po_header_id) AS total_po_count,
                GROUP_CONCAT(
                    h.po_number
                    ORDER BY h.po_header_id ASC 
                    SEPARATOR '\n'
                ) AS po_numbers,
                GROUP_CONCAT(
                    DATE_FORMAT(h.created_at, '%Y-%m-%d')
                    ORDER BY h.po_header_id ASC 
                    SEPARATOR '\n'
                ) AS created_dates,
                GROUP_CONCAT(
                    IFNULL(DATE_FORMAT(h.requested_delivery_date, '%Y-%m-%d'), '-')
                    ORDER BY h.po_header_id ASC 
                    SEPARATOR '\n'
                ) AS requested_delivery_dates,
                GROUP_CONCAT(
                    d.base_qty
                    ORDER BY h.po_header_id ASC 
                    SEPARATOR '\n'
                ) AS po_required_qtys,
                GROUP_CONCAT(
                    GREATEST(0, d.base_qty - d.fulfilled_qty)
                    ORDER BY h.po_header_id ASC 
                    SEPARATOR '\n'
                ) AS po_remaining_qtys
            FROM sipuro_db.po_details d
            JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
            JOIN sipuro_db.products p ON d.id_product = p.id_product
            WHERE ${whereSql}
            GROUP BY p.id_product, p.product_code, p.product_name, p.base_uom
            ${orderBySql}
            LIMIT ${limitNum} OFFSET ${offset};
        `;

        const [rows] = await sipuroDb.query(query, queryParams);

        res.json({
            success: true,
            data: rows,
            pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
        });
    } catch (error) {
        console.error('Error fetching outstanding summary:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch outstanding batch summary.', error: error.message });
    }
};
