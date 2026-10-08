const { sipuroDb: db } = require('../../config/db');

/**
 * Get List of Delivery Orders from delivery_orders table
 */
exports.getDeliveryOrders = async (req, res) => {
    try {
        const {
            search = '',
            startDate = '',
            endDate = '',
            completedStartDate = '',
            completedEndDate = '',
            sortBy = 'do_created_date',
            sortOrder = 'DESC',
            page = 1,
            limit = 10
        } = req.query;

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        const fromClause = `
            FROM sipuro_db.delivery_orders do_tbl
            JOIN sipuro_db.products p ON do_tbl.product_id = p.id_product
            LEFT JOIN sipuro_db.po_batch_allocations pba ON do_tbl.po_batch_allocation_id = pba.id
            LEFT JOIN sipuro_db.batches b ON pba.id_batch = b.id
        `;

        const whereConditions = [];
        const queryParams = [];

        if (search.trim() !== '') {
            const searchPattern = `%${search.trim()}%`;
            whereConditions.push(
                '(do_tbl.po_number LIKE ? OR do_tbl.do_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ?)'
            );
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        if (startDate) {
            whereConditions.push('DATE(do_tbl.do_created_date) >= ?');
            queryParams.push(startDate);
        }
        if (endDate) {
            whereConditions.push('DATE(do_tbl.do_created_date) <= ?');
            queryParams.push(endDate);
        }

        if (completedStartDate) {
            whereConditions.push('DATE(b.actual_completed_date) >= ?');
            queryParams.push(completedStartDate);
        }
        if (completedEndDate) {
            whereConditions.push('DATE(b.actual_completed_date) <= ?');
            queryParams.push(completedEndDate);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const allowedSortColumns = {
            po_number: 'do_tbl.po_number',
            do_number: 'do_tbl.do_number',
            po_created_date: 'do_tbl.po_created_date',
            do_created_date: 'do_tbl.do_created_date',
            actual_completed_date: 'b.actual_completed_date',
            product_name: 'p.product_name',
            qty_ctn: 'do_tbl.qty_ctn',
            qty_pcs: 'do_tbl.qty_pcs'
        };

        const sortColumn = allowedSortColumns[sortBy] || 'do_tbl.do_created_date';
        const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const countQuery = `SELECT COUNT(*) AS total ${fromClause} ${whereClause}`;
        const [countRows] = await db.query(countQuery, queryParams);
        const totalItems = countRows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum) || 1;

        const dataQuery = `
            SELECT 
                do_tbl.id AS do_id,
                do_tbl.po_batch_allocation_id,
                do_tbl.po_number,
                DATE_FORMAT(do_tbl.po_created_date, '%Y-%m-%d') AS po_created_date,
                do_tbl.do_number,
                DATE_FORMAT(do_tbl.do_created_date, '%Y-%m-%d') AS do_created_date,
                DATE_FORMAT(do_tbl.pick_up_date, '%Y-%m-%d') AS pick_up_date,
                DATE_FORMAT(b.actual_completed_date, '%Y-%m-%d') AS actual_completed_date,
                p.product_code,
                p.product_name,
                do_tbl.qty_ctn,
                do_tbl.qty_pcs
            ${fromClause}
            ${whereClause}
            ORDER BY ${sortColumn} ${orderDirection}, do_tbl.id DESC
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
        console.error('Error fetching delivery orders:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch delivery orders data.',
            error: error.message
        });
    }
};
