const { sipuroDb: db } = require('../../config/db');

/**
 * Get List of Sales Invoices from sales_invoices table
 */
exports.getSalesInvoices = async (req, res) => {
    try {
        const {
            search = '',
            startDate = '',
            endDate = '',
            pickUpStartDate = '',
            pickUpEndDate = '',
            sortBy = 'si_date',
            sortOrder = 'DESC',
            page = 1,
            limit = 10
        } = req.query;

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        const fromClause = `
            FROM sipuro_db.sales_invoices si_tbl
            JOIN sipuro_db.products p ON si_tbl.product_id = p.id_product
            LEFT JOIN sipuro_db.delivery_orders do_tbl ON si_tbl.delivery_order_id = do_tbl.id
        `;

        const whereConditions = [];
        const queryParams = [];

        if (search.trim() !== '') {
            const searchPattern = `%${search.trim()}%`;
            whereConditions.push(
                '(si_tbl.si_number LIKE ? OR si_tbl.do_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ?)'
            );
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        if (startDate) {
            whereConditions.push('DATE(si_tbl.si_date) >= ?');
            queryParams.push(startDate);
        }
        if (endDate) {
            whereConditions.push('DATE(si_tbl.si_date) <= ?');
            queryParams.push(endDate);
        }

        if (pickUpStartDate) {
            whereConditions.push('DATE(si_tbl.pick_up_date) >= ?');
            queryParams.push(pickUpStartDate);
        }
        if (pickUpEndDate) {
            whereConditions.push('DATE(si_tbl.pick_up_date) <= ?');
            queryParams.push(pickUpEndDate);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const allowedSortColumns = {
            si_number: 'si_tbl.si_number',
            do_number: 'si_tbl.do_number',
            si_date: 'si_tbl.si_date',
            pick_up_date: 'si_tbl.pick_up_date',
            product_name: 'p.product_name',
            qty_ctn: 'si_tbl.qty_ctn',
            qty_pcs: 'si_tbl.qty_pcs'
        };

        const sortColumn = allowedSortColumns[sortBy] || 'si_tbl.si_date';
        const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const countQuery = `SELECT COUNT(*) AS total ${fromClause} ${whereClause}`;
        const [countRows] = await db.query(countQuery, queryParams);
        const totalItems = countRows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum) || 1;

        const dataQuery = `
            SELECT 
                si_tbl.id AS si_id,
                si_tbl.delivery_order_id,
                si_tbl.do_number,
                si_tbl.si_number,
                DATE_FORMAT(si_tbl.si_date, '%Y-%m-%d') AS si_date,
                DATE_FORMAT(si_tbl.pick_up_date, '%Y-%m-%d') AS pick_up_date,
                p.product_code,
                p.product_name,
                si_tbl.qty_ctn,
                si_tbl.qty_pcs
            ${fromClause}
            ${whereClause}
            ORDER BY ${sortColumn} ${orderDirection}, si_tbl.id DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(dataQuery, [...queryParams, limitNum, offset]);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching sales invoices:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch sales invoices data.',
            error: error.message
        });
    }
};
