const { sipuroDb } = require('../../../config/db');
const { getWeeksListBetween } = require('../../../helpers/weekHelper');
const { safeError } = require('../../../helpers/safeError');
const {
    NOT_DELETED_SQL, APPROVED_HEADER_SQL, OPEN_ITEM_SQL, REMAINING_SQL
} = require('../../../helpers/po/openItemRules');
const { hasCurrentPriceSql } = require('../../../helpers/po/currentPriceRules');

/**
 * 1. Menampilkan Halaman Utama PO Requirement
 */
exports.getPORequirementSummary = async (req, res) => {
    try {
        const { search, start_week, end_week } = req.query;

        const weekList = getWeeksListBetween(start_week, end_week);

        let productWhereClauses = ['p.is_active = 1'];
        let productQueryParams = [];

        if (search) {
            productWhereClauses.push('(p.product_code LIKE ? OR p.product_name LIKE ?)');
            productQueryParams.push(`%${search}%`, `%${search}%`);
        }

        const productWhereSql = productWhereClauses.join(' AND ');

        const mainQuery = `
            SELECT 
                p.id_product,
                p.product_code,
                p.product_name,
                p.base_uom,
                IFNULL(po_summary.total_po_outstanding, 0) AS po_outstanding_qty,
                IFNULL(plan_summary.total_plan_qty, 0) AS total_production_plan_qty,
                ${hasCurrentPriceSql('p')} AS has_active_price
            FROM sipuro_db.products p
            LEFT JOIN (
                SELECT 
                    d.id_product,
                    SUM(${REMAINING_SQL}) AS total_po_outstanding
                FROM sipuro_db.po_details d
                JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
                WHERE ${NOT_DELETED_SQL}
                  AND ${APPROVED_HEADER_SQL}
                  AND ${OPEN_ITEM_SQL}
                GROUP BY d.id_product
            ) po_summary ON p.id_product = po_summary.id_product
            LEFT JOIN (
                SELECT 
                    pp.id_product,
                    SUM(ppi.qty) AS total_plan_qty
                FROM sipuro_db.production_plans pp
                JOIN sipuro_db.production_plan_revisions ppr ON pp.id_plan = ppr.id_plan
                JOIN sipuro_db.production_plan_items ppi ON ppr.id_revision = ppi.id_revision
                WHERE ppr.revision_type = 'CAMPINA_PLAN'
                  AND CONCAT(ppi.year, '-', LPAD(ppi.week_number, 2, '0')) IN (?)
                GROUP BY pp.id_product
            ) plan_summary ON p.id_product = plan_summary.id_product
            WHERE ${productWhereSql}
            ORDER BY p.product_code ASC;
        `;

        const formattedWeekKeys = weekList.map(w => `${w.year}-${String(w.week_number).padStart(2, '0')}`);
        const queryParams = [formattedWeekKeys.length > 0 ? formattedWeekKeys : [''], ...productQueryParams];

        const [rows] = await sipuroDb.query(mainQuery, queryParams);

        const formattedData = rows.map(row => {
            const poOutstanding = Number(row.po_outstanding_qty) || 0;
            const totalPlan = Number(row.total_production_plan_qty) || 0;
            const remaining = poOutstanding - totalPlan;

            return {
                id_product: row.id_product,
                product_code: row.product_code,
                product_name: row.product_name,
                base_uom: row.base_uom,
                po_outstanding_qty: poOutstanding,
                total_production_plan_qty: totalPlan,
                remaining_qty: remaining,
                has_active_price: Number(row.has_active_price) === 1,
                required_po_qty: 0
            };
        });

        res.json({
            success: true,
            weeks: weekList,
            data: formattedData
        });

    } catch (error) {
        console.error('Error in getPORequirementSummary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch PO Requirement summary data.',
            error: safeError(error)
        });
    }
};

/**
 * 2. Menampilkan Detail Breakdown per Week + Alokasi FIFO PO (Untuk Modal)
 */
exports.getPORequirementDetail = async (req, res) => {
    try {
        const { id_product } = req.params;
        const { start_week, end_week } = req.query;

        const weekList = getWeeksListBetween(start_week, end_week);

        const [prodRows] = await sipuroDb.query(
            `SELECT id_product, product_code, product_name, base_uom FROM sipuro_db.products WHERE id_product = ?`,
            [id_product]
        );

        if (prodRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found.' });
        }

        const productInfo = prodRows[0];

        const poQuery = `
            SELECT 
                h.po_header_id,
                h.po_number,
                DATE_FORMAT(h.created_at, '%Y-%m-%d') AS created_date,
                d.base_qty AS required_qty,
                ${REMAINING_SQL} AS remaining_qty
            FROM sipuro_db.po_details d
            JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
            WHERE d.id_product = ?
              AND ${NOT_DELETED_SQL}
              AND ${APPROVED_HEADER_SQL}
              AND ${OPEN_ITEM_SQL}
            ORDER BY h.created_at ASC, h.po_header_id ASC, d.po_detail_id ASC;
        `;
        const [poList] = await sipuroDb.query(poQuery, [id_product]);

        const planQuery = `
            SELECT 
                ppi.year,
                ppi.week_number,
                ppi.qty
            FROM sipuro_db.production_plans pp
            JOIN sipuro_db.production_plan_revisions ppr ON pp.id_plan = ppr.id_plan
            JOIN sipuro_db.production_plan_items ppi ON ppr.id_revision = ppi.id_revision
            WHERE pp.id_product = ?
              AND ppr.revision_type = 'CAMPINA_PLAN'
        `;
        const [planItems] = await sipuroDb.query(planQuery, [id_product]);

        const weeklyPlanMap = {};
        planItems.forEach(item => {
            const key = `${item.year}_${item.week_number}`;
            weeklyPlanMap[key] = Number(item.qty) || 0;
        });

        const poPool = poList.map(po => ({
            ...po,
            allocatable_qty: Number(po.remaining_qty) || 0
        }));

        const weeklyBreakdown = weekList.map(w => {
            const key = `${w.year}_${w.week_number}`;
            let neededQty = weeklyPlanMap[key] || 0;
            const totalPlanQty = neededQty;
            const allocatedPOs = [];

            if (neededQty > 0) {
                for (let po of poPool) {
                    if (neededQty <= 0) break;

                    if (po.allocatable_qty > 0) {
                        const takeQty = Math.min(neededQty, po.allocatable_qty);

                        allocatedPOs.push({
                            po_number: po.po_number,
                            allocated_qty: takeQty
                        });

                        po.allocatable_qty -= takeQty;
                        neededQty -= takeQty;
                    }
                }
            }

            return {
                year: w.year,
                week_number: w.week_number,
                date_label: w.date_label,
                plan_qty: totalPlanQty,
                allocated_pos: allocatedPOs,
                uncovered_qty: neededQty
            };
        });

        res.json({
            success: true,
            product: productInfo,
            weeks: weeklyBreakdown,
            outstanding_pos: poList
        });

    } catch (error) {
        console.error('Error in getPORequirementDetail:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch PO Requirement detail.',
            error: safeError(error)
        });
    }
};

/**
 * 3. GET CUSTOMER LIST FOR SELECTION
 */
exports.getCustomersList = async (req, res) => {
    try {
        const [rows] = await sipuroDb.query(
            `SELECT customer_id, company_name, customer_code FROM sipuro_db.customers WHERE is_active = 1 ORDER BY company_name ASC`
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch customers list.' });
    }
};
