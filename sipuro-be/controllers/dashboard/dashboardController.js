const { sipuroDb } = require('../../config/db');
const { getWibYear, getWibDate } = require('../../helpers/dateHelper');

// Statistik Dashboard
exports.getDashboardStats = async (req, res) => {
    try {
        const { mode = 'YTD', startDate, endDate, selectedYear, selectedMonth, id_product } = req.query;

        // Mendapatkan fallback waktu presisi WIB jika selectedYear/selectedMonth tidak dikirim oleh frontend
        const nowWib = getWibDate();
        const fallbackYear = getWibYear();
        const fallbackMonth = `${fallbackYear}-${String(nowWib.getMonth() + 1).padStart(2, '0')}`;

        const currentYear = selectedYear || fallbackYear;
        const currentMonth = selectedMonth || fallbackMonth;

        // Menyusun kondisi filter produk untuk JOIN po_details pada query tren
        let productFilterClause = '';
        let productParams = [];

        if (id_product && id_product !== 'ALL' && id_product !== '') {
            productFilterClause = ' AND pod.id_product = ?';
            productParams.push(id_product);
        }

        let trendQuery = '';
        let trendParams = [];

        if (mode === 'MTD') {
            const firstDayOfMonth = `${currentMonth}-01`;
            trendQuery = `
                WITH RECURSIVE dates AS (
                    SELECT CAST(? AS DATE) AS date_val
                    UNION ALL
                    SELECT date_val + INTERVAL 1 DAY
                    FROM dates
                    WHERE date_val + INTERVAL 1 DAY <= LAST_DAY(?)
                )
                SELECT 
                    DATE_FORMAT(d.date_val, '%Y-%m-%d') AS label_key,
                    DATE_FORMAT(d.date_val, '%d %b') AS month_label,
                    COALESCE(SUM(pod.base_qty), 0) AS total_volume,
                    COALESCE(SUM(pba.total_fulfilled), 0) AS total_fulfilled
                FROM dates d
                LEFT JOIN sipuro_db.po_headers poh 
                    ON DATE(CONVERT_TZ(poh.created_at, '+00:00', '+07:00')) = d.date_val
                   AND poh.status NOT IN ('Draft', 'Waiting for Confirmation', 'Rejected', 'Canceled')
                LEFT JOIN sipuro_db.po_details pod 
                    ON poh.po_header_id = pod.po_header_id 
                   AND pod.deleted_at IS NULL${productFilterClause}
                LEFT JOIN (
                    SELECT po_detail_id, SUM(fulfilled_qty) AS total_fulfilled
                    FROM sipuro_db.po_batch_allocations
                    GROUP BY po_detail_id
                ) pba ON pod.po_detail_id = pba.po_detail_id
                GROUP BY d.date_val, label_key, month_label
                ORDER BY d.date_val ASC;
            `;
            trendParams = [firstDayOfMonth, firstDayOfMonth, ...productParams];
        } else {
            const firstDayOfYear = `${currentYear}-01-01`;
            const lastDayOfYear = `${currentYear}-12-01`;
            trendQuery = `
                WITH RECURSIVE months AS (
                    SELECT CAST(? AS DATE) AS month_val
                    UNION ALL
                    SELECT month_val + INTERVAL 1 MONTH
                    FROM months
                    WHERE month_val + INTERVAL 1 MONTH <= CAST(? AS DATE)
                )
                SELECT 
                    DATE_FORMAT(m.month_val, '%Y-%m') AS label_key,
                    DATE_FORMAT(m.month_val, '%b %Y') AS month_label,
                    COALESCE(SUM(pod.base_qty), 0) AS total_volume,
                    COALESCE(SUM(pba.total_fulfilled), 0) AS total_fulfilled
                FROM months m
                LEFT JOIN sipuro_db.po_headers poh 
                    ON DATE_FORMAT(CONVERT_TZ(poh.created_at, '+00:00', '+07:00'), '%Y-%m') = DATE_FORMAT(m.month_val, '%Y-%m')
                   AND poh.status NOT IN ('Draft', 'Waiting for Confirmation', 'Rejected', 'Canceled')
                LEFT JOIN sipuro_db.po_details pod 
                    ON poh.po_header_id = pod.po_header_id 
                   AND pod.deleted_at IS NULL${productFilterClause}
                LEFT JOIN (
                    SELECT po_detail_id, SUM(fulfilled_qty) AS total_fulfilled
                    FROM sipuro_db.po_batch_allocations
                    GROUP BY po_detail_id
                ) pba ON pod.po_detail_id = pba.po_detail_id
                GROUP BY m.month_val, label_key, month_label
                ORDER BY m.month_val ASC;
            `;
            trendParams = [firstDayOfYear, lastDayOfYear, ...productParams];
        }

        const [monthlyStats] = await sipuroDb.query(trendQuery, trendParams);

        let statusWhere = [];
        // Mengecualikan 4 status untuk filter top 5 products
        let topProductsWhere = [
            `d.deleted_at IS NULL`,
            `h.status NOT IN ('Draft', 'Waiting for Confirmation', 'Rejected', 'Canceled')`
        ];
        let queryParamsStatus = [];
        let queryParamsTop = [];

        if (startDate) {
            statusWhere.push(`DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) >= ?`);
            topProductsWhere.push(`DATE(CONVERT_TZ(h.created_at, '+00:00', '+07:00')) >= ?`);
            queryParamsStatus.push(startDate);
            queryParamsTop.push(startDate);
        }

        if (endDate) {
            statusWhere.push(`DATE(CONVERT_TZ(created_at, '+00:00', '+07:00')) <= ?`);
            topProductsWhere.push(`DATE(CONVERT_TZ(h.created_at, '+00:00', '+07:00')) <= ?`);
            queryParamsStatus.push(endDate);
            queryParamsTop.push(endDate);
        }

        const statusWhereClause = statusWhere.length > 0 ? `WHERE ${statusWhere.join(' AND ')}` : '';
        const topProductsWhereClause = `WHERE ${topProductsWhere.join(' AND ')}`;

        const [statusStats] = await sipuroDb.query(`
            SELECT status, COUNT(*) AS count 
            FROM sipuro_db.po_headers 
            ${statusWhereClause}
            GROUP BY status;
        `, queryParamsStatus);

        const [topProducts] = await sipuroDb.query(`
            SELECT 
                p.product_code,
                p.product_name,
                COALESCE(SUM(d.base_qty), 0) AS total_qty
            FROM sipuro_db.po_details d
            JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
            JOIN sipuro_db.products p ON d.id_product = p.id_product
            ${topProductsWhereClause}
            GROUP BY d.id_product, p.product_code, p.product_name
            ORDER BY total_qty DESC
            LIMIT 5;
        `, queryParamsTop);

        res.json({
            success: true,
            data: { monthlyStats, statusStats, topProducts }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard statistics.', error: error.message });
    }
};
