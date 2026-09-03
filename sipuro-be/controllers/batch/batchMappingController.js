const { sipuroDb } = require('../../config/db');

// Mapping Batch ke PO
exports.getAllocatedBatchMapping = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const { search, fromDate, toDate, planDate, batchStatus } = req.query;

        let whereClauses = [];
        let queryParams = [];

        if (search) {
            whereClauses.push(`(b.batch_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR h.po_number LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (fromDate) {
            whereClauses.push(`DATE(b.plan_production_date) >= ?`);
            queryParams.push(fromDate);
        }

        if (toDate) {
            whereClauses.push(`DATE(b.plan_production_date) <= ?`);
            queryParams.push(toDate);
        }

        if (planDate && !fromDate && !toDate) {
            whereClauses.push(`DATE(b.plan_production_date) = ?`);
            queryParams.push(planDate);
        }

        if (batchStatus) {
            whereClauses.push(`b.status = ?`);
            queryParams.push(batchStatus);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const countQuery = `
            SELECT COUNT(DISTINCT b.id) AS total
            FROM sipuro_db.batches b
            JOIN sipuro_db.products p ON b.id_product = p.id_product
            JOIN sipuro_db.po_batch_allocations pba ON b.id = pba.id_batch
            JOIN sipuro_db.po_details d ON pba.po_detail_id = d.po_detail_id
            JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
            ${whereSql};
        `;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = Number(countRows[0]?.total || 0);
        const totalPages = Math.ceil(totalItems / limitNum);

        const query = `
            SELECT 
                b.id AS id_batch,
                b.batch_number,
                b.status AS batch_status,
                b.plan_production_date,
                p.product_code,
                p.product_name,
                SUM(pba.allocated_qty) AS total_allocated_qty,
                SUM(pba.fulfilled_qty) AS total_fulfilled_qty,
                GROUP_CONCAT(
                    CONCAT(h.po_number, ':', pba.allocated_qty, ':', pba.fulfilled_qty, ':', pba.status)
                    SEPARATOR '||'
                ) AS raw_po_allocations
            FROM sipuro_db.batches b
            JOIN sipuro_db.products p ON b.id_product = p.id_product
            JOIN sipuro_db.po_batch_allocations pba ON b.id = pba.id_batch
            JOIN sipuro_db.po_details d ON pba.po_detail_id = d.po_detail_id
            JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
            ${whereSql}
            GROUP BY b.id, b.batch_number, b.status, b.plan_production_date, p.product_code, p.product_name
            ORDER BY b.id DESC
            LIMIT ${limitNum} OFFSET ${offset};
        `;

        const [rows] = await sipuroDb.query(query, queryParams);

        const formattedRows = rows.map(row => {
            const allocations = row.raw_po_allocations
                ? row.raw_po_allocations.split('||').map(item => {
                    const [po_number, allocated_qty, fulfilled_qty, status] = item.split(':');
                    return {
                        po_number,
                        allocated_qty: Number(allocated_qty) || 0,
                        fulfilled_qty: Number(fulfilled_qty) || 0,
                        status
                    };
                })
                : [];

            delete row.raw_po_allocations;
            return { ...row, po_allocations: allocations };
        });

        res.json({
            success: true,
            data: formattedRows,
            pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
        });
    } catch (error) {
        console.error('Error fetching batch mapping:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil riwayat mapping batch.', error: error.message });
    }
};
