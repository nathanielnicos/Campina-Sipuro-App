const { sipuroDb } = require('../../config/db');
const { refreshPOStatus } = require('../../helpers/batchHelper');

// Mengambil daftar produk yang belum dialokasikan ke batch
exports.getUnassignedSummary = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const { searchProduct, searchPo } = req.query;

        let whereClauses = [
            `h.status IN ('Waiting for Batch Assignment', 'In Progress')`,
            `d.deleted_at IS NULL`,
            `(d.base_qty - IFNULL(alloc.total_allocated, 0)) > 0`
        ];
        let queryParams = [];

        if (searchProduct) {
            whereClauses.push(`(p.product_code LIKE ? OR p.product_name LIKE ?)`);
            queryParams.push(`%${searchProduct}%`, `%${searchProduct}%`);
        }

        if (searchPo) {
            whereClauses.push(`h.po_number LIKE ?`);
            queryParams.push(`%${searchPo}%`);
        }

        const whereSql = whereClauses.join(' AND ');

        const countQuery = `
            SELECT COUNT(*) AS total FROM (
                SELECT p.id_product
                FROM sipuro_db.po_details d
                JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
                JOIN sipuro_db.products p ON d.id_product = p.id_product
                LEFT JOIN (
                    SELECT po_detail_id, SUM(allocated_qty) AS total_allocated
                    FROM sipuro_db.po_batch_allocations
                    WHERE status != 'Canceled'
                    GROUP BY po_detail_id
                ) alloc ON d.po_detail_id = alloc.po_detail_id
                WHERE ${whereSql}
                GROUP BY p.id_product
            ) sub;
        `;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = Number(countRows[0]?.total || 0);
        const totalPages = Math.ceil(totalItems / limitNum);

        const query = `
            SELECT 
                p.id_product,
                p.product_code,
                p.product_name,
                p.base_uom,
                SUM(d.base_qty - IFNULL(alloc.total_allocated, 0)) AS total_qty_needed,
                COUNT(DISTINCT CASE WHEN (d.base_qty - IFNULL(alloc.total_allocated, 0)) > 0 THEN h.po_header_id END) AS total_po_count,
                GROUP_CONCAT(
                    DISTINCT IF(
                        (d.base_qty - IFNULL(alloc.total_allocated, 0)) > 0,
                        CONCAT(
                            h.po_number, ' (', 
                            (d.base_qty - IFNULL(alloc.total_allocated, 0)), ' ', 
                            p.base_uom, ')'
                        ),
                        NULL
                    )
                    ORDER BY h.po_header_id ASC 
                    SEPARATOR '\n'
                ) AS po_numbers
            FROM sipuro_db.po_details d
            JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
            JOIN sipuro_db.products p ON d.id_product = p.id_product
            LEFT JOIN (
                SELECT po_detail_id, SUM(allocated_qty) AS total_allocated
                FROM sipuro_db.po_batch_allocations
                WHERE status != 'Canceled'
                GROUP BY po_detail_id
            ) alloc ON d.po_detail_id = alloc.po_detail_id
            WHERE ${whereSql}
            GROUP BY p.id_product, p.product_code, p.product_name, p.base_uom
            ORDER BY p.product_code ASC
            LIMIT ${limitNum} OFFSET ${offset};
        `;

        const [rows] = await sipuroDb.query(query, queryParams);

        res.json({
            success: true,
            data: rows,
            pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
        });
    } catch (error) {
        console.error('Error fetching unassigned summary:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil rekap kebutuhan batch.', error: error.message });
    }
};

// Mengambil daftar batch berstatus "Open" berdasarkan SKU
exports.getBatchesBySku = async (req, res) => {
    try {
        const { id_product } = req.params;
        const query = `
            SELECT id AS id_batch, batch_number, plan_production_date, expired_date, status
            FROM sipuro_db.batches
            WHERE id_product = ? AND status = 'Open'
            ORDER BY id DESC;
        `;
        const [rows] = await sipuroDb.query(query, [id_product]);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching batches by SKU:', error);
        res.status(500).json({ success: false, message: 'Gagal mengambil daftar batch eksisting.' });
    }
};

// Mengalokasikan produk dari beberapa PO ke batch
exports.assignBatchBulk = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const {
            id_product,
            allocation_mode,
            selected_batch_id,
            batch_number,
            plan_production_date,
            expired_date,
            allocated_qty,
            created_by
        } = req.body;

        const reqQty = Number(allocated_qty);

        if (!id_product || !reqQty || reqQty <= 0) {
            return res.status(400).json({ success: false, message: 'Kuantitas alokasi harus lebih besar dari 0.' });
        }

        await connection.beginTransaction();

        const [unassignedItems] = await connection.query(`
            SELECT 
                d.po_detail_id, 
                d.po_header_id, 
                d.base_qty,
                IFNULL(alloc.total_allocated, 0) AS total_allocated,
                (d.base_qty - IFNULL(alloc.total_allocated, 0)) AS remaining_qty
            FROM sipuro_db.po_details d
            JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
            LEFT JOIN (
                SELECT po_detail_id, SUM(allocated_qty) AS total_allocated
                FROM sipuro_db.po_batch_allocations
                WHERE status != 'Canceled'
                GROUP BY po_detail_id
            ) alloc ON d.po_detail_id = alloc.po_detail_id
            WHERE d.id_product = ? 
              AND h.status IN ('Waiting for Batch Assignment', 'In Progress')
              AND d.deleted_at IS NULL
              AND (d.base_qty - IFNULL(alloc.total_allocated, 0)) > 0
            ORDER BY d.po_header_id ASC, d.po_detail_id ASC
        `, [id_product]);

        const totalNeeded = unassignedItems.reduce((acc, curr) => acc + Number(curr.remaining_qty), 0);

        if (unassignedItems.length === 0 || totalNeeded === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Tidak ada PO menggantung yang membutuhkan alokasi untuk SKU ini.' });
        }

        if (reqQty > totalNeeded) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: `Qty input (${reqQty}) melebihi total sisa kebutuhan (${totalNeeded}).` });
        }

        let targetId;
        let finalBatchNumber = batch_number;

        if (allocation_mode === 'EXISTING') {
            const [existingBatch] = await connection.query(
                `SELECT id, batch_number, status FROM sipuro_db.batches WHERE id = ?`,
                [selected_batch_id]
            );
            if (existingBatch.length === 0 || existingBatch[0].status !== 'Open') {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Batch eksisting tidak ditemukan atau sudah Closed.' });
            }
            targetId = existingBatch[0].id;
            finalBatchNumber = existingBatch[0].batch_number;
        } else {
            if (!batch_number || !plan_production_date) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Nomor batch dan tanggal produksi wajib diisi.' });
            }

            const [checkDup] = await connection.query(`SELECT id FROM sipuro_db.batches WHERE batch_number = ?`, [batch_number]);
            if (checkDup.length > 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: `Nomor batch '${batch_number}' sudah terdaftar.` });
            }

            const [newBatch] = await connection.query(
                `INSERT INTO sipuro_db.batches (batch_number, id_product, plan_production_date, expired_date, status, created_by)
                 VALUES (?, ?, ?, ?, 'Open', ?)`,
                [batch_number, id_product, plan_production_date, expired_date || null, created_by || null]
            );
            targetId = newBatch.insertId;
        }

        let remainingToDistribute = reqQty;
        const affectedHeaders = new Set();

        for (const item of unassignedItems) {
            if (remainingToDistribute <= 0) break;

            const allocForThisItem = Math.min(item.remaining_qty, remainingToDistribute);

            await connection.query(
                `INSERT INTO sipuro_db.po_batch_allocations (po_detail_id, id_batch, allocated_qty, fulfilled_qty, status, created_by) 
                 VALUES (?, ?, ?, 0, 'Open', ?)
                 ON DUPLICATE KEY UPDATE allocated_qty = allocated_qty + VALUES(allocated_qty)`,
                [item.po_detail_id, targetId, allocForThisItem, created_by || null]
            );

            remainingToDistribute -= allocForThisItem;
            affectedHeaders.add(item.po_header_id);
        }

        for (const poHeaderId of affectedHeaders) {
            await refreshPOStatus(connection, poHeaderId);
        }

        await connection.commit();
        res.json({ success: true, message: `Berhasil mengalokasikan ${reqQty} qty ke Batch '${finalBatchNumber}'!` });
    } catch (error) {
        await connection.rollback();
        console.error('Error assigning batch bulk:', error);
        res.status(500).json({ success: false, message: 'Gagal mengalokasikan batch.', error: error.message });
    } finally {
        connection.release();
    }
};
