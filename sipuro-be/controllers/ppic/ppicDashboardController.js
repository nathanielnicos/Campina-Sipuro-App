const { sipuroDb } = require('../../config/db');

// Statistik Dashboard PPIC
exports.getDashboardStats = async (req, res) => {
    try {
        const { mode = 'YTD', startDate, endDate } = req.query;

        let trendQuery = '';

        if (mode === 'MTD') {
            trendQuery = `
                WITH RECURSIVE dates AS (
                    SELECT DATE_FORMAT(NOW(), '%Y-%m-01') AS date_val
                    UNION ALL
                    SELECT date_val + INTERVAL 1 DAY
                    FROM dates
                    WHERE date_val + INTERVAL 1 DAY <= CURRENT_DATE()
                )
                SELECT 
                    DATE_FORMAT(d.date_val, '%Y-%m-%d') AS label_key,
                    DATE_FORMAT(d.date_val, '%d %b') AS month_label,
                    COALESCE(SUM(pod.base_qty), 0) AS total_volume
                FROM dates d
                LEFT JOIN sipuro_db.po_headers poh 
                    ON DATE(poh.created_at) = d.date_val
                   AND poh.status NOT IN ('Rejected', 'Canceled')
                LEFT JOIN sipuro_db.po_details pod 
                    ON poh.po_header_id = pod.po_header_id AND pod.deleted_at IS NULL
                GROUP BY d.date_val, label_key, month_label
                ORDER BY d.date_val ASC;
            `;
        } else {
            trendQuery = `
                WITH RECURSIVE months AS (
                    SELECT DATE_FORMAT(NOW(), '%Y-01-01') AS month_val
                    UNION ALL
                    SELECT month_val + INTERVAL 1 MONTH
                    FROM months
                    WHERE month_val + INTERVAL 1 MONTH <= DATE_FORMAT(NOW(), '%Y-%m-01')
                )
                SELECT 
                    DATE_FORMAT(m.month_val, '%Y-%m') AS label_key,
                    DATE_FORMAT(m.month_val, '%b %Y') AS month_label,
                    COALESCE(SUM(pod.base_qty), 0) AS total_volume
                FROM months m
                LEFT JOIN sipuro_db.po_headers poh 
                    ON DATE_FORMAT(poh.created_at, '%Y-%m') = DATE_FORMAT(m.month_val, '%Y-%m')
                   AND poh.status NOT IN ('Rejected', 'Canceled')
                LEFT JOIN sipuro_db.po_details pod 
                    ON poh.po_header_id = pod.po_header_id AND pod.deleted_at IS NULL
                GROUP BY m.month_val, label_key, month_label
                ORDER BY m.month_val ASC;
            `;
        }

        const [monthlyStats] = await sipuroDb.query(trendQuery);

        let statusWhere = [];
        let topProductsWhere = [`d.deleted_at IS NULL`, `h.status NOT IN ('Rejected', 'Canceled')`];
        let queryParamsStatus = [];
        let queryParamsTop = [];

        if (startDate) {
            statusWhere.push(`DATE(created_at) >= ?`);
            topProductsWhere.push(`DATE(h.created_at) >= ?`);
            queryParamsStatus.push(startDate);
            queryParamsTop.push(startDate);
        }

        if (endDate) {
            statusWhere.push(`DATE(created_at) <= ?`);
            topProductsWhere.push(`DATE(h.created_at) <= ?`);
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
        console.error('Error fetching PPIC dashboard stats:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data statistik dasbor.', error: error.message });
    }
};
