const { sipuroDb: db } = require('../../config/db');

/**
 * Get List of Delivery Orders (PO Batch Allocations yang tidak 'Canceled' dan qty > 0)
 * Accessible by: LOGISTIC and FINANCE departments
 */
exports.getDeliveryOrders = async (req, res) => {
    try {
        const {
            search = '',
            startDate = '',
            endDate = '',
            completedStartDate = '',
            completedEndDate = '',
            sortBy = 'po_created_date',
            sortOrder = 'DESC',
            page = 1,
            limit = 10
        } = req.query;

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        // Base FROM & JOIN Clause
        const fromClause = `
            FROM sipuro_db.po_batch_allocations pba
            JOIN sipuro_db.po_details pd ON pba.po_detail_id = pd.po_detail_id
            JOIN sipuro_db.po_headers ph ON pd.po_header_id = ph.po_header_id
            JOIN sipuro_db.products p ON pd.id_product = p.id_product
            LEFT JOIN sipuro_db.batches b ON pba.id_batch = b.id
        `;

        // Dynamic WHERE Clause
        const whereConditions = [
            "pba.status != 'Canceled'",
            "pba.allocated_qty > 0"
        ];
        const queryParams = [];

        // 1. Search Filter (PO Number, DO Number, Product Code, Product Name)
        if (search.trim() !== '') {
            const searchPattern = `%${search.trim()}%`;
            whereConditions.push(
                '(ph.po_number LIKE ? OR ph.do_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ?)'
            );
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // 2. Filter PO Created Date Range
        if (startDate) {
            whereConditions.push('DATE(ph.created_at) >= ?');
            queryParams.push(startDate);
        }
        if (endDate) {
            whereConditions.push('DATE(ph.created_at) <= ?');
            queryParams.push(endDate);
        }

        // 3. Filter Actual Complete Date Range
        if (completedStartDate) {
            whereConditions.push('DATE(b.actual_completed_date) >= ?');
            queryParams.push(completedStartDate);
        }
        if (completedEndDate) {
            whereConditions.push('DATE(b.actual_completed_date) <= ?');
            queryParams.push(completedEndDate);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        // Dynamic Sorting Mapping (Mencegah SQL Injection pada column name)
        const allowedSortColumns = {
            po_number: 'ph.po_number',
            do_number: 'ph.do_number',
            po_created_date: 'ph.created_at',
            actual_completed_date: 'b.actual_completed_date',
            destination: 'ph.delivery_address',
            product_name: 'p.product_name',
            qty_ctn: 'qty_ctn',
            description: 'ph.description'
        };

        const sortColumn = allowedSortColumns[sortBy] || 'ph.created_at';
        const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // 1. Query Total Count
        const countQuery = `SELECT COUNT(*) AS total ${fromClause} ${whereClause}`;
        const [countRows] = await db.query(countQuery, queryParams);
        const totalItems = countRows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum) || 1;

        // 2. Query Data dengan Limit & Offset
        const dataQuery = `
            SELECT 
                pba.id AS allocation_id,
                ph.po_number,
                ph.do_number,
                DATE_FORMAT(ph.created_at, '%Y-%m-%d') AS po_created_date,
                DATE_FORMAT(b.actual_completed_date, '%Y-%m-%d') AS actual_completed_date,
                ph.delivery_address AS destination,
                NULL AS license_plate,
                p.product_code,
                p.product_name,
                pba.allocated_qty,
                pd.pcs_per_ctn,
                CASE 
                    WHEN pd.pcs_per_ctn IS NOT NULL AND pd.pcs_per_ctn > 0 
                    THEN ROUND(pba.allocated_qty / pd.pcs_per_ctn, 2)
                    ELSE 0 
                END AS qty_ctn,
                ph.description,
                pba.status AS allocation_status
            ${fromClause}
            ${whereClause}
            ORDER BY ${sortColumn} ${orderDirection}, pba.id DESC
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
