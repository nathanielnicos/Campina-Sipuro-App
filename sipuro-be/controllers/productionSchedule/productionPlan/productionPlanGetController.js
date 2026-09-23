const { sipuroDb } = require('../../../config/db');
const { getDefaultRollingWeeks, generateWeekRange, getStartDateOfISOWeek } = require('../../../helpers/weekHelper');

/**
 * Helper untuk memapar format "YYYY-Www" (contoh: "2026-W34" -> { year: 2026, week: 34 })
 */
const parseWeekString = (weekStr) => {
    if (!weekStr || !weekStr.includes('-W')) return null;
    const parts = weekStr.split('-W');
    const year = parseInt(parts[0], 10);
    const week = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(week)) return null;
    return { year, week };
};

/**
 * Helper untuk menghitung jumlah minggu di antara dua rentang ISO Week secara akurat
 */
const getWeeksListBetween = (startStr, endStr) => {
    const startParsed = parseWeekString(startStr);
    const endParsed = parseWeekString(endStr);

    if (!startParsed || !endParsed) {
        return getDefaultRollingWeeks();
    }

    const startDate = getStartDateOfISOWeek(startParsed.week, startParsed.year);
    const endDate = getStartDateOfISOWeek(endParsed.week, endParsed.year);

    if (startDate > endDate) {
        return getDefaultRollingWeeks();
    }

    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    const count = Math.floor(diffDays / 7) + 1;

    const safeCount = Math.min(Math.max(count, 1), 104);

    return generateWeekRange(startParsed.week, startParsed.year, safeCount);
};

/**
 * 1. Menampilkan Halaman Utama Production Plan (List Master Produk + Campina's Plan)
 */
exports.getProductionPlansSummary = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const { search, start_week, end_week } = req.query;

        const weekList = getWeeksListBetween(start_week, end_week);

        let whereClauses = ['p.is_active = 1'];
        let queryParams = [];

        if (search) {
            whereClauses.push('(p.product_code LIKE ? OR p.product_name LIKE ?)');
            queryParams.push(`%${search}%`, `%${search}%`);
        }

        const whereSql = whereClauses.join(' AND ');

        const countQuery = `SELECT COUNT(*) AS total FROM sipuro_db.products p WHERE ${whereSql};`;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = Number(countRows[0]?.total || 0);
        const totalPages = Math.ceil(totalItems / limitNum);

        const productsQuery = `
            SELECT p.id_product, p.product_code, p.product_name, p.base_uom
            FROM sipuro_db.products p
            WHERE ${whereSql}
            ORDER BY p.product_code ASC
            LIMIT ${limitNum} OFFSET ${offset};
        `;
        const [products] = await sipuroDb.query(productsQuery, queryParams);

        if (products.length === 0) {
            return res.json({
                success: true,
                data: [],
                weeks: weekList,
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });
        }

        const productIds = products.map(p => p.id_product);

        const planItemsQuery = `
            SELECT 
                pp.id_product,
                ppi.year,
                ppi.week_number,
                ppi.qty
            FROM sipuro_db.production_plans pp
            JOIN sipuro_db.production_plan_revisions ppr ON pp.id_plan = ppr.id_plan
            JOIN sipuro_db.production_plan_items ppi ON ppr.id_revision = ppi.id_revision
            WHERE ppr.revision_type = 'CAMPINA_PLAN'
              AND pp.id_product IN (?)
        `;
        const [planItems] = await sipuroDb.query(planItemsQuery, [productIds]);

        const rows = products.map(prod => {
            const campinaPlanMap = {};
            weekList.forEach(w => {
                const key = `${w.year}_${w.week_number}`;
                campinaPlanMap[key] = 0;
            });

            planItems.forEach(item => {
                if (item.id_product === prod.id_product) {
                    const key = `${item.year}_${item.week_number}`;
                    if (Object.prototype.hasOwnProperty.call(campinaPlanMap, key)) {
                        campinaPlanMap[key] = Number(item.qty) || 0;
                    }
                }
            });

            return {
                ...prod,
                campina_plans: campinaPlanMap
            };
        });

        res.json({
            success: true,
            data: rows,
            weeks: weekList,
            pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
        });
    } catch (error) {
        console.error('Error getProductionPlansSummary:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch Production Plan data.', error: error.message });
    }
};

/**
 * 2. Menampilkan Detail Plan & Revisions untuk Modal berdasarkan Product ID
 */
exports.getProductionPlanDetail = async (req, res) => {
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

        const [planRows] = await sipuroDb.query(
            `SELECT id_plan FROM sipuro_db.production_plans WHERE id_product = ?`,
            [id_product]
        );

        if (planRows.length === 0) {
            return res.json({
                success: true,
                product: productInfo,
                weeks: weekList,
                has_existing_plan: false,
                revisions: []
            });
        }

        const id_plan = planRows[0].id_plan;

        const [revisions] = await sipuroDb.query(
            `SELECT id_revision, revision_type, revision_label, revision_date, created_at 
             FROM sipuro_db.production_plan_revisions 
             WHERE id_plan = ? 
             ORDER BY id_revision ASC`,
            [id_plan]
        );

        const revIds = revisions.map(r => r.id_revision);
        let itemsMap = {};

        if (revIds.length > 0) {
            const [items] = await sipuroDb.query(
                `SELECT id_revision, year, week_number, qty FROM sipuro_db.production_plan_items WHERE id_revision IN (?)`,
                [revIds]
            );

            items.forEach(it => {
                if (!itemsMap[it.id_revision]) itemsMap[it.id_revision] = {};
                itemsMap[it.id_revision][`${it.year}_${it.week_number}`] = Number(it.qty) || 0;
            });
        }

        const formattedRevisions = revisions.map(r => {
            const weekQtyMap = {};
            weekList.forEach(w => {
                const key = `${w.year}_${w.week_number}`;
                weekQtyMap[key] = itemsMap[r.id_revision]?.[key] ?? 0;
            });

            return {
                id_revision: r.id_revision,
                revision_type: r.revision_type,
                revision_label: r.revision_label,
                revision_date: r.revision_date,
                created_at: r.created_at,
                weeks_data: weekQtyMap
            };
        });

        res.json({
            success: true,
            product: productInfo,
            id_plan,
            weeks: weekList,
            has_existing_plan: true,
            revisions: formattedRevisions
        });

    } catch (error) {
        console.error('Error getProductionPlanDetail:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch Production Plan detail.', error: error.message });
    }
};
