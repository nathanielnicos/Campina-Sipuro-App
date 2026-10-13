const { sipuroDb: db } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const {
    isoDateTimeSql,
    isoDateSql,
    likePattern,
    parsePagination,
    addDateTimeRange,
    addDateRange
} = require('../../helpers/upload-document-flow/listQueryHelper');

const ALLOWED_SORT_COLUMNS = {
    do_number: 'do_tbl.do_number',
    do_created_date: 'do_tbl.do_created_date',
    pick_up_date: 'do_tbl.pick_up_date',
    product_name: 'p.product_name',
    qty_ctn: 'do_tbl.qty_ctn'
};

/**
 * Delivery Orders for the "Delivery Order" tab.
 * Pagination is per DO (parent row). Each DO carries its batch allocation lines (child rows).
 */
exports.getDeliveryOrders = async (req, res) => {
    try {
        const {
            search = '',
            startDate = '',
            endDate = '',
            pickUpStartDate = '',
            pickUpEndDate = '',
            sortBy = 'do_created_date',
            sortOrder = 'DESC'
        } = req.query;
        const { page, limit, offset } = parsePagination(req.query);

        const fromClause = `
            FROM delivery_orders do_tbl
            JOIN products p ON do_tbl.product_id = p.id_product
        `;

        const conditions = [];
        const params = [];

        const term = String(search).trim();
        if (term !== '') {
            const pattern = likePattern(term);
            conditions.push(`(
                do_tbl.do_number LIKE ? ESCAPE '!'
                OR do_tbl.customer_po_text LIKE ? ESCAPE '!'
                OR p.product_code LIKE ? ESCAPE '!'
                OR p.product_name LIKE ? ESCAPE '!'
                OR EXISTS (
                    SELECT 1
                    FROM delivery_order_allocations doa
                    JOIN po_batch_allocations pba ON pba.id = doa.po_batch_allocation_id
                    JOIN po_details pd ON pd.po_detail_id = pba.po_detail_id
                    JOIN po_headers ph ON ph.po_header_id = pd.po_header_id
                    WHERE doa.delivery_order_id = do_tbl.id AND ph.po_number LIKE ? ESCAPE '!'
                )
            )`);
            params.push(pattern, pattern, pattern, pattern, pattern);
        }

        addDateTimeRange(conditions, params, 'do_tbl.do_created_date', startDate, endDate);
        addDateRange(conditions, params, 'do_tbl.pick_up_date', pickUpStartDate, pickUpEndDate);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sortColumn = ALLOWED_SORT_COLUMNS[sortBy] || ALLOWED_SORT_COLUMNS.do_created_date;
        const direction = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const [countRows] = await db.query(`SELECT COUNT(*) AS total ${fromClause} ${whereClause}`, params);
        const totalItems = Number(countRows[0] && countRows[0].total) || 0;
        const totalPages = Math.ceil(totalItems / limit) || 1;

        // Page of parent rows
        const [parents] = await db.query(
            `SELECT
                do_tbl.id AS do_id,
                do_tbl.do_number,
                ${isoDateTimeSql('do_tbl.do_created_date')} AS do_created_date,
                ${isoDateSql('do_tbl.pick_up_date')} AS pick_up_date,
                do_tbl.customer_po_text,
                p.product_code,
                p.product_name,
                p.pcs_per_ctn,
                do_tbl.qty_ctn,
                do_tbl.qty_pcs
             ${fromClause}
             ${whereClause}
             ORDER BY ${sortColumn} ${direction}, do_tbl.id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Child rows of this page
        const childrenByDo = new Map();
        if (parents.length > 0) {
            const [children] = await db.query(
                `SELECT
                    doa.id AS line_id,
                    doa.delivery_order_id,
                    doa.po_batch_allocation_id AS allocation_id,
                    doa.qty_pcs,
                    ph.po_number,
                    ${isoDateTimeSql('ph.created_at')} AS po_created_date,
                    b.batch_number,
                    ${isoDateTimeSql('b.actual_completed_date')} AS actual_completed_date
                 FROM delivery_order_allocations doa
                 JOIN po_batch_allocations pba ON pba.id = doa.po_batch_allocation_id
                 JOIN po_details pd ON pd.po_detail_id = pba.po_detail_id
                 JOIN po_headers ph ON ph.po_header_id = pd.po_header_id
                 JOIN batches b ON b.id = pba.id_batch
                 WHERE doa.delivery_order_id IN (?)
                 ORDER BY doa.delivery_order_id, b.actual_completed_date ASC, doa.id ASC`,
                [parents.map((p) => p.do_id)]
            );
            children.forEach((c) => {
                if (!childrenByDo.has(c.delivery_order_id)) childrenByDo.set(c.delivery_order_id, []);
                childrenByDo.get(c.delivery_order_id).push(c);
            });
        }

        const data = parents.map((p) => {
            const pcsPerCtn = Number(p.pcs_per_ctn) || 0;
            return {
                ...p,
                allocations: (childrenByDo.get(p.do_id) || []).map((c) => ({
                    line_id: c.line_id,
                    allocation_id: c.allocation_id,
                    po_number: c.po_number,
                    po_created_date: c.po_created_date,
                    batch_number: c.batch_number,
                    actual_completed_date: c.actual_completed_date,
                    qty_pcs: Number(c.qty_pcs),
                    // May be fractional when a DO is split over batches
                    qty_ctn: pcsPerCtn > 0 ? Math.round((Number(c.qty_pcs) / pcsPerCtn) * 100) / 100 : null
                }))
            };
        });

        return res.json({
            success: true,
            data,
            pagination: { currentPage: page, totalPages, totalItems, limit }
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Get Delivery Orders Error',
            fallbackMessage: 'Failed to fetch delivery orders data.'
        });
    }
};
