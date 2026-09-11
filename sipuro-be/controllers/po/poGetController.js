const { sipuroDb } = require('../../config/db');

exports.getPOList = async (req, res) => {
    try {
        const {
            customer_id,
            page = 1,
            limit = 10,
            search,
            // 1. Rentang Tanggal Created Date
            startDate,
            endDate,
            // 2. Rentang Tanggal Requested Delivery Date
            deliveryStartDate,
            deliveryEndDate,
            status,
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = req.query;

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        const conditions = [];
        const queryParams = [];

        if (customer_id && customer_id !== 'null' && customer_id !== 'undefined') {
            conditions.push('h.customer_id = ?');
            queryParams.push(customer_id);
        }

        if (search && search.trim() !== '') {
            conditions.push('h.po_number LIKE ?');
            queryParams.push(`%${search.trim()}%`);
        }

        // Filter 1: Created Date Range
        if (startDate && startDate !== '') {
            conditions.push('DATE(h.created_at) >= ?');
            queryParams.push(startDate);
        }

        if (endDate && endDate !== '') {
            conditions.push('DATE(h.created_at) <= ?');
            queryParams.push(endDate);
        }

        // Filter 2: Requested Delivery Date Range
        if (deliveryStartDate && deliveryStartDate !== '') {
            conditions.push('DATE(h.requested_delivery_date) >= ?');
            queryParams.push(deliveryStartDate);
        }

        if (deliveryEndDate && deliveryEndDate !== '') {
            conditions.push('DATE(h.requested_delivery_date) <= ?');
            queryParams.push(deliveryEndDate);
        }

        if (status && status !== '') {
            conditions.push('h.status = ?');
            queryParams.push(status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Pemetaan kolom untuk mencegah SQL Injection
        const validSortColumns = {
            po_number: 'h.po_number',
            created_at: 'h.created_at',
            requested_delivery_date: 'h.requested_delivery_date',
            total_items: 'total_items',
            total_price: 'h.total_amount',
            status: 'h.status'
        };

        const sortColumn = validSortColumns[sortBy] || 'h.created_at';
        const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        const countQuery = `
            SELECT COUNT(DISTINCT h.po_header_id) AS total
            FROM sipuro_db.po_headers h
            ${whereClause}
        `;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = countRows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum);

        const query = `
            SELECT h.po_header_id, h.po_number, h.created_at, h.requested_delivery_date, h.total_amount, h.status, c.company_name, COUNT(d.po_detail_id) AS total_items
            FROM sipuro_db.po_headers h
            LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id
            LEFT JOIN sipuro_db.po_details d ON h.po_header_id = d.po_header_id AND d.deleted_at IS NULL
            ${whereClause}
            GROUP BY h.po_header_id
            ORDER BY ${sortColumn} ${sortDirection}
            LIMIT ? OFFSET ?
        `;

        const dataQueryParams = [...queryParams, limitNum, offset];
        const [rows] = await sipuroDb.query(query, dataQueryParams);

        res.json({
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
        console.error('Error fetching PO list:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch Purchase Order list.', error: error.message });
    }
};

exports.getPODetail = async (req, res) => {
    try {
        const { id } = req.params;
        const headerQuery = `
            SELECT 
                h.*, 
                c.company_name, 
                c.customer_code, 
                c.address,
                creator.full_name AS creator_name,
                updater.full_name AS updater_name
            FROM sipuro_db.po_headers h
            LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id
            LEFT JOIN sipuro_db.customer_users creator ON h.created_by = creator.customer_user_id
            LEFT JOIN sipuro_db.customer_users updater ON h.updated_by = updater.customer_user_id
            WHERE h.po_header_id = ?
        `;
        const [headerRows] = await sipuroDb.query(headerQuery, [id]);
        if (headerRows.length === 0) {
            return res.status(404).json({ success: false, message: 'PO data not found.' });
        }

        const detailQuery = `
            SELECT d.*, p.product_code, p.product_name, p.base_uom, p.pcs_per_ctn, p.ctn_per_plt
            FROM sipuro_db.po_details d
            JOIN sipuro_db.products p ON d.id_product = p.id_product
            WHERE d.po_header_id = ? AND d.deleted_at IS NULL
        `;
        const [detailRows] = await sipuroDb.query(detailQuery, [id]);

        res.json({ success: true, data: { header: headerRows[0], items: detailRows } });
    } catch (error) {
        console.error('Error fetching PO detail:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch PO details.', error: error.message });
    }
};
