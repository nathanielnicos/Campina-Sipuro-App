const { sipuroDb: db } = require('../../../config/db');

exports.getSalesInvoiceMapping = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const {
            search = '',
            displayMode = 'BY_SI',
            fromSiDate,
            toSiDate,
            sortOrder = 'DESC'
        } = req.query;

        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        let whereClauses = [];
        let queryParams = [];

        if (search) {
            whereClauses.push(`(si.si_number LIKE ? OR si.do_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (fromSiDate) {
            whereClauses.push(`si.si_date >= ?`);
            queryParams.push(fromSiDate);
        }
        if (toSiDate) {
            whereClauses.push(`si.si_date <= ?`);
            queryParams.push(toSiDate);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // MODE 1: BY SI NUMBER
        if (displayMode === 'BY_SI') {
            const countQuery = `
                SELECT COUNT(DISTINCT si.si_number) AS total
                FROM sales_invoices si
                JOIN products p ON si.product_id = p.id_product
                LEFT JOIN delivery_orders d ON si.delivery_order_id = d.id
                ${whereSql};
            `;
            const [countRows] = await db.query(countQuery, queryParams);
            const totalItems = Number(countRows[0]?.total || 0);
            const totalPages = Math.ceil(totalItems / limitNum);

            if (totalItems === 0) {
                return res.json({ success: true, displayMode, data: [], pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum } });
            }

            const distinctSiQuery = `
                SELECT DISTINCT si.si_number, si.si_date
                FROM sales_invoices si
                JOIN products p ON si.product_id = p.id_product
                LEFT JOIN delivery_orders d ON si.delivery_order_id = d.id
                ${whereSql}
                ORDER BY si.si_date ${order}, si.si_number ${order}
                LIMIT ${limitNum} OFFSET ${offset};
            `;
            const [siRows] = await db.query(distinctSiQuery, queryParams);
            const siNumbers = siRows.map(r => r.si_number);

            const placeholders = siNumbers.map(() => '?').join(',');
            const detailQueryParams = [...queryParams, ...siNumbers];
            const detailWhereSql = whereSql ? `${whereSql} AND si.si_number IN (${placeholders})` : `WHERE si.si_number IN (${placeholders})`;

            const query = `
                SELECT 
                    si.id AS si_id,
                    si.si_number,
                    si.si_date,
                    si.do_number,
                    d.do_created_date,
                    p.id_product,
                    p.product_code,
                    p.product_name,
                    si.qty_ctn,
                    si.qty_pcs
                FROM sales_invoices si
                JOIN products p ON si.product_id = p.id_product
                LEFT JOIN delivery_orders d ON si.delivery_order_id = d.id
                ${detailWhereSql}
                ORDER BY si.si_date ${order}, si.si_number ${order}, si.id ASC;
            `;
            const [rows] = await db.query(query, detailQueryParams);

            const siMap = new Map();
            rows.forEach(r => {
                if (!siMap.has(r.si_number)) {
                    siMap.set(r.si_number, {
                        si_number: r.si_number,
                        si_date: r.si_date,
                        items: []
                    });
                }
                siMap.get(r.si_number).items.push({
                    si_id: r.si_id,
                    do_number: r.do_number,
                    do_created_date: r.do_created_date,
                    product_code: r.product_code,
                    product_name: r.product_name,
                    qty_ctn: r.qty_ctn,
                    qty_pcs: r.qty_pcs
                });
            });

            return res.json({
                success: true,
                displayMode,
                data: Array.from(siMap.values()),
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });

        // MODE 2: BY DO NUMBER
        } else {
            const countQuery = `
                SELECT COUNT(DISTINCT si.do_number) AS total
                FROM sales_invoices si
                JOIN products p ON si.product_id = p.id_product
                LEFT JOIN delivery_orders d ON si.delivery_order_id = d.id
                ${whereSql};
            `;
            const [countRows] = await db.query(countQuery, queryParams);
            const totalItems = Number(countRows[0]?.total || 0);
            const totalPages = Math.ceil(totalItems / limitNum);

            const query = `
                SELECT 
                    si.id AS si_id,
                    si.do_number,
                    d.do_created_date,
                    si.si_number,
                    si.si_date,
                    p.product_code,
                    p.product_name,
                    si.qty_ctn,
                    si.qty_pcs
                FROM sales_invoices si
                JOIN products p ON si.product_id = p.id_product
                LEFT JOIN delivery_orders d ON si.delivery_order_id = d.id
                ${whereSql}
                ORDER BY si.do_number ${order}, si.id ASC
                LIMIT ${limitNum} OFFSET ${offset};
            `;
            const [rows] = await db.query(query, queryParams);

            const doMap = new Map();
            rows.forEach(r => {
                if (!doMap.has(r.do_number)) {
                    doMap.set(r.do_number, {
                        do_number: r.do_number,
                        do_created_date: r.do_created_date,
                        invoices: []
                    });
                }
                doMap.get(r.do_number).invoices.push({
                    si_id: r.si_id,
                    si_number: r.si_number,
                    si_date: r.si_date,
                    product_code: r.product_code,
                    product_name: r.product_name,
                    qty_ctn: r.qty_ctn,
                    qty_pcs: r.qty_pcs
                });
            });

            return res.json({
                success: true,
                displayMode,
                data: Array.from(doMap.values()),
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });
        }
    } catch (error) {
        console.error('Error fetching SI mapping list:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch SI mapping list.', error: error.message });
    }
};
