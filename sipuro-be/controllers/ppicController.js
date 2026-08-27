const XLSX = require('xlsx');
const { sipuroDb } = require('../config/db');
const { refreshPOStatus, AUTO_CLOSE_THRESHOLD_PERCENT } = require('../helpers/ppicHelper');

// 1. Mengambil Rekap SKU yang belum dialokasikan ke Batch (Tab 1 - Filter & Server-side Pagination)
exports.getUnassignedSummary = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const { searchProduct, searchPo } = req.query;

        // Filtering Clause
        let whereClauses = [
            `h.status IN ('Waiting Batch Assignment', 'On Process')`,
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

        // Query Total Unique SKU yang membutuhkan alokasi
        const countQuery = `
            SELECT COUNT(*) AS total FROM (
                SELECT p.id_product
                FROM sipuro_db.po_details d
                JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
                JOIN sipuro_db.products p ON d.id_product = p.id_product
                LEFT JOIN (
                    SELECT po_detail_id, SUM(allocated_qty) AS total_allocated
                    FROM sipuro_db.po_batch_allocations
                    GROUP BY po_detail_id
                ) alloc ON d.po_detail_id = alloc.po_detail_id
                WHERE ${whereSql}
                GROUP BY p.id_product
            ) sub;
        `;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = Number(countRows[0]?.total || 0);
        const totalPages = Math.ceil(totalItems / limitNum);

        // Query Data Paged
        const query = `
            SELECT 
                p.id_product,
                p.product_code,
                p.product_name,
                p.base_uom,
                SUM(d.base_qty - IFNULL(alloc.total_allocated, 0)) AS total_qty_needed,
                COUNT(DISTINCT h.po_header_id) AS total_po_count,
                GROUP_CONCAT(
                    DISTINCT CONCAT(
                        h.po_number, ' (', 
                        FORMAT(d.base_qty - IFNULL(alloc.total_allocated, 0), 0), ' ', 
                        p.base_uom, ')'
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
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching unassigned summary:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil rekap kebutuhan batch.',
            error: error.message
        });
    }
};

// 2. Mengambil Detail Mapping Batch ke PO (Tab 2 - Filter & Server-side Pagination)
exports.getAllocatedBatchMapping = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const { search, planDate, batchStatus } = req.query;

        let whereClauses = [];
        let queryParams = [];

        if (search) {
            whereClauses.push(`(b.batch_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR h.po_number LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (planDate) {
            whereClauses.push(`DATE(b.plan_production_date) = ?`);
            queryParams.push(planDate);
        }

        if (batchStatus) {
            whereClauses.push(`b.status = ?`);
            queryParams.push(batchStatus);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Query Total Items
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

        // Query Data Paged
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

        // Parse string GROUP_CONCAT menjadi array object po_allocations
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
            return {
                ...row,
                po_allocations: allocations
            };
        });

        res.json({
            success: true,
            data: formattedRows,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching batch mapping:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil riwayat mapping batch.',
            error: error.message
        });
    }
};

// 3. Mengambil daftar batch eksisting yang berstatus Open berdasarkan SKU
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

// 4. Mengalokasikan Batch (Mendukung Parsial Qty & Reuse Batch Eksisting)
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
            allocated_qty
        } = req.body;

        const reqQty = Number(allocated_qty);

        if (!id_product || !reqQty || reqQty <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Kuantitas alokasi harus lebih besar dari 0.'
            });
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
                GROUP BY po_detail_id
            ) alloc ON d.po_detail_id = alloc.po_detail_id
            WHERE d.id_product = ? 
              AND h.status IN ('Waiting Batch Assignment', 'On Process')
              AND d.deleted_at IS NULL
              AND (d.base_qty - IFNULL(alloc.total_allocated, 0)) > 0
            ORDER BY d.po_header_id ASC, d.po_detail_id ASC
        `, [id_product]);

        const totalNeeded = unassignedItems.reduce((acc, curr) => acc + Number(curr.remaining_qty), 0);

        if (unassignedItems.length === 0 || totalNeeded === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Tidak ada PO menggantung yang membutuhkan alokasi untuk SKU ini.'
            });
        }

        if (reqQty > totalNeeded) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Qty input (${reqQty}) melebihi total sisa kebutuhan (${totalNeeded}).`
            });
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
                return res.status(400).json({ success: false, message: 'Batch eksisting tidak ditemukan atau sudah Close.' });
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
                `INSERT INTO sipuro_db.batches (batch_number, id_product, plan_production_date, expired_date, status) 
                 VALUES (?, ?, ?, ?, 'Open')`,
                [batch_number, id_product, plan_production_date, expired_date || null]
            );
            targetId = newBatch.insertId;
        }

        let remainingToDistribute = reqQty;
        const affectedHeaders = new Set();

        for (const item of unassignedItems) {
            if (remainingToDistribute <= 0) break;

            const allocForThisItem = Math.min(item.remaining_qty, remainingToDistribute);

            await connection.query(
                `INSERT INTO sipuro_db.po_batch_allocations (po_detail_id, id_batch, allocated_qty, fulfilled_qty, status) 
                 VALUES (?, ?, ?, 0, 'Open')
                 ON DUPLICATE KEY UPDATE allocated_qty = allocated_qty + VALUES(allocated_qty)`,
                [item.po_detail_id, targetId, allocForThisItem]
            );

            remainingToDistribute -= allocForThisItem;
            affectedHeaders.add(item.po_header_id);
        }

        for (const poHeaderId of affectedHeaders) {
            await refreshPOStatus(connection, poHeaderId);
        }

        await connection.commit();

        res.json({
            success: true,
            message: `Berhasil mengalokasikan ${reqQty} qty ke Batch '${finalBatchNumber}'!`
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error assigning batch bulk:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengalokasikan batch.',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

// 5. Preview Output File Excel
exports.previewProduction = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'File Excel wajib diunggah.' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        const batchOutputMap = {};
        sheetData.forEach((row, idx) => {
            if (idx > 4 && row[1]) {
                const batchNum = String(row[1]).trim();
                const qtyCar = parseFloat(row[12] || row[13]) || 0;
                if (batchNum && qtyCar > 0) {
                    batchOutputMap[batchNum] = (batchOutputMap[batchNum] || 0) + qtyCar;
                }
            }
        });

        const previewResults = [];
        const unallocatedStocks = [];

        for (const [batchNum, actualOutput] of Object.entries(batchOutputMap)) {
            const [allocations] = await sipuroDb.query(`
                SELECT 
                    b.id AS id_batch,
                    b.batch_number,
                    b.id_product,
                    p.product_code,
                    p.product_name,
                    pba.id AS allocation_id,
                    pba.po_detail_id,
                    pba.allocated_qty,
                    pba.fulfilled_qty AS current_fulfilled,
                    h.po_number,
                    h.po_header_id
                FROM sipuro_db.batches b
                JOIN sipuro_db.products p ON b.id_product = p.id_product
                JOIN sipuro_db.po_batch_allocations pba ON b.id = pba.id_batch
                JOIN sipuro_db.po_details d ON pba.po_detail_id = d.po_detail_id
                JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
                WHERE b.batch_number = ? AND b.status = 'Open' AND pba.status = 'Open'
            `, [batchNum]);

            if (allocations.length > 0) {
                const targetQty = allocations.reduce((acc, curr) => acc + Number(curr.allocated_qty), 0);
                const ratio = targetQty > 0 ? actualOutput / targetQty : 0;

                allocations.forEach(alloc => {
                    const calculatedFulfilled = Math.round(alloc.allocated_qty * ratio);
                    previewResults.push({
                        allocation_id: alloc.allocation_id,
                        po_detail_id: alloc.po_detail_id,
                        po_header_id: alloc.po_header_id,
                        id_batch: alloc.id_batch,
                        batch_number: batchNum,
                        po_number: alloc.po_number,
                        product_code: alloc.product_code,
                        product_name: alloc.product_name,
                        allocatedQty: alloc.allocated_qty,
                        fulfilledQty: calculatedFulfilled,
                        rowStatus: calculatedFulfilled >= alloc.allocated_qty ? 'Close' : 'Open'
                    });
                });

                if (actualOutput > targetQty) {
                    unallocatedStocks.push({
                        id_batch: allocations[0].id_batch,
                        batch_number: batchNum,
                        id_product: allocations[0].id_product,
                        product_code: allocations[0].product_code,
                        product_name: allocations[0].product_name,
                        surplusQty: actualOutput - targetQty
                    });
                }
            }
        }

        if (previewResults.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tidak ada batch aktif di DB yang cocok dengan nomor batch di file Excel ini.'
            });
        }

        res.json({
            success: true,
            message: 'Preview hasil alokasi berhasil diproses.',
            data: {
                processTimestamp: new Date().toISOString(),
                fileName: req.file.originalname,
                previewResults,
                unallocatedStocks
            }
        });

    } catch (error) {
        console.error('Error previewing production:', error);
        res.status(500).json({ success: false, message: 'Gagal membaca file Excel', error: error.message });
    }
};

// 6. Konfirmasi Simpan Hasil Produksi ke DB
exports.confirmProduction = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { allocations, unallocatedStocks } = req.body;

        if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
            return res.status(400).json({ success: false, message: 'Data alokasi konfirmasi tidak valid.' });
        }

        await connection.beginTransaction();

        const affectedHeaders = new Set();
        const affectedBatches = new Set();

        for (const item of allocations) {
            const addQty = Number(item.fulfilledQty) || 0;

            await connection.query(
                `UPDATE sipuro_db.po_batch_allocations SET fulfilled_qty = fulfilled_qty + ?, status = ? WHERE id = ?`,
                [addQty, item.rowStatus, item.allocation_id]
            );

            await connection.query(
                `UPDATE sipuro_db.po_details SET fulfilled_qty = fulfilled_qty + ? WHERE po_detail_id = ?`,
                [addQty, item.po_detail_id]
            );

            affectedHeaders.add(item.po_header_id);
            affectedBatches.add(item.id_batch);
        }

        // Simpan Lebihan Stok (Unallocated Stocks)
        if (unallocatedStocks && Array.isArray(unallocatedStocks) && unallocatedStocks.length > 0) {
            for (const stock of unallocatedStocks) {
                await connection.query(
                    `INSERT INTO sipuro_db.unallocated_stocks (id_batch, id_product, qty_available, production_date)
                     VALUES (?, ?, ?, CURDATE())
                     ON DUPLICATE KEY UPDATE qty_available = qty_available + VALUES(qty_available)`,
                    [stock.id_batch, stock.id_product, stock.surplusQty]
                );
            }
        }

        // Update status batch jika semua alokasinya closed
        for (const batchId of affectedBatches) {
            const [openAlloc] = await connection.query(
                `SELECT id FROM sipuro_db.po_batch_allocations WHERE id_batch = ? AND status = 'Open'`,
                [batchId]
            );

            if (openAlloc.length === 0) {
                await connection.query(
                    `UPDATE sipuro_db.batches SET status = 'Close', actual_production_date = CURDATE() WHERE id = ?`,
                    [batchId]
                );
            }
        }

        for (const poHeaderId of affectedHeaders) {
            await refreshPOStatus(connection, poHeaderId);
        }

        await connection.commit();
        res.json({ success: true, message: 'Hasil realisasi produksi berhasil disimpan ke database!' });

    } catch (error) {
        await connection.rollback();
        console.error('Error confirming production:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan hasil produksi', error: error.message });
    } finally {
        connection.release();
    }
};

// 7. Mengambil Statistik Data Dasbor PPIC (Mendukung YTD, MTD, & Filter Tanggal Dibuat PO)
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
            SELECT 
                status, 
                COUNT(*) AS count 
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
            data: {
                monthlyStats,
                statusStats,
                topProducts
            }
        });
    } catch (error) {
        console.error('Error fetching PPIC dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data statistik dasbor.',
            error: error.message
        });
    }
};
