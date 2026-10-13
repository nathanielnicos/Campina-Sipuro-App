const { sipuroDb: db } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const {
    isoDateTimeSql,
    isoDateSql,
    likePattern,
    parsePagination,
    addDateRange
} = require('../../helpers/upload-document-flow/listQueryHelper');

const ALLOWED_SORT_COLUMNS = {
    si_number: 'si_tbl.si_number',
    do_number: 'si_tbl.do_number',
    si_date: 'si_tbl.si_date',
    pick_up_date: 'si_tbl.pick_up_date',
    do_created_date: 'do_tbl.do_created_date',
    product_name: 'p.product_name',
    qty_ctn: 'si_tbl.qty_ctn'
};

/**
 * Sales Invoices for the "Sales Invoice" tab (one row per SI x DO x item).
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
            sortOrder = 'DESC'
        } = req.query;
        const { page, limit, offset } = parsePagination(req.query);

        const fromClause = `
            FROM sales_invoices si_tbl
            JOIN products p ON si_tbl.product_id = p.id_product
            LEFT JOIN delivery_orders do_tbl ON si_tbl.delivery_order_id = do_tbl.id
        `;

        const conditions = [];
        const params = [];

        const term = String(search).trim();
        if (term !== '') {
            const pattern = likePattern(term);
            conditions.push(`(
                si_tbl.si_number LIKE ? ESCAPE '!'
                OR si_tbl.do_number LIKE ? ESCAPE '!'
                OR p.product_code LIKE ? ESCAPE '!'
                OR p.product_name LIKE ? ESCAPE '!'
            )`);
            params.push(pattern, pattern, pattern, pattern);
        }

        // si_date and pick_up_date are DATE columns
        addDateRange(conditions, params, 'si_tbl.si_date', startDate, endDate);
        addDateRange(conditions, params, 'si_tbl.pick_up_date', pickUpStartDate, pickUpEndDate);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sortColumn = ALLOWED_SORT_COLUMNS[sortBy] || ALLOWED_SORT_COLUMNS.si_date;
        const direction = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const [countRows] = await db.query(`SELECT COUNT(*) AS total ${fromClause} ${whereClause}`, params);
        const totalItems = Number(countRows[0] && countRows[0].total) || 0;
        const totalPages = Math.ceil(totalItems / limit) || 1;

        const [rows] = await db.query(
            `SELECT
                si_tbl.id AS si_id,
                si_tbl.delivery_order_id,
                si_tbl.do_number,
                ${isoDateTimeSql('do_tbl.do_created_date')} AS do_created_date,
                si_tbl.si_number,
                ${isoDateSql('si_tbl.si_date')} AS si_date,
                ${isoDateSql('si_tbl.pick_up_date')} AS pick_up_date,
                p.product_code,
                p.product_name,
                si_tbl.qty_ctn,
                si_tbl.qty_pcs
             ${fromClause}
             ${whereClause}
             ORDER BY ${sortColumn} ${direction}, si_tbl.id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return res.json({
            success: true,
            data: rows,
            pagination: { currentPage: page, totalPages, totalItems, limit }
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Get Sales Invoices Error',
            fallbackMessage: 'Failed to fetch sales invoices data.'
        });
    }
};
