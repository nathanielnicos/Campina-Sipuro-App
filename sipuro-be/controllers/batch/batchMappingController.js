const { sipuroDb } = require('../../config/db');
const { getPOTolerance, refreshPOStatus, refreshBatchStatus } = require('../../helpers/batchHelper');
const { logAllocationUpdate } = require('../../helpers/poBatchAllocationLogHelper');

// Helper untuk menyusun klausa ORDER BY yang aman dari SQL Injection
const buildOrderByClause = (displayMode, sortKey, sortOrder) => {
    const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    const batchSortMap = {
        'batch_number': 'b.batch_number',
        'product_name': 'p.product_name',
        'plan_production_date': 'b.plan_production_date',
        'batch_status': 'b.status',
        'po_number': 'h.po_number',
        'allocated_qty': 'total_allocated_qty',
        'fulfilled_qty': 'total_fulfilled_qty',
        'status': 'pba.status'
    };

    const poSortMap = {
        'po_number': 'h.po_number',
        'po_created_date': 'h.created_at',
        'po_requested_delivery_date': 'h.requested_delivery_date',
        'product_name': 'p.product_name',
        'batch_number': 'b.batch_number',
        'allocated_qty': 'total_allocated_qty',
        'fulfilled_qty': 'total_fulfilled_qty',
        'status': 'pba.status'
    };

    if (displayMode === 'BY_PO') {
        const column = poSortMap[sortKey] || 'h.po_header_id';
        return `ORDER BY ${column} ${order}`;
    } else {
        const column = batchSortMap[sortKey] || 'b.id';
        return `ORDER BY ${column} ${order}`;
    }
};

// 1. Mapping Batch ke PO (Get List Data)
exports.getAllocatedBatchMapping = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const {
            search,
            batchStatus,
            displayMode = 'BY_BATCH',
            sortKey,
            sortOrder,
            fromPlanDate, toPlanDate,
            fromActualDate, toActualDate,
            fromCreatedDate, toCreatedDate,
            fromDeliveryDate, toDeliveryDate
        } = req.query;

        // Diselaraskan dengan controller export: memfilter PO detail yang aktif saja
        let whereClauses = ['d.deleted_at IS NULL'];
        let queryParams = [];

        // Filter Pencarian Teks
        if (search) {
            whereClauses.push(`(b.batch_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR h.po_number LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Filter Status Batch
        if (batchStatus) {
            whereClauses.push(`b.status = ?`);
            queryParams.push(batchStatus);
        }

        // 1. Filter Planned Production Date
        if (fromPlanDate) {
            whereClauses.push(`b.plan_production_date >= ?`);
            queryParams.push(`${fromPlanDate} 00:00:00`);
        }
        if (toPlanDate) {
            whereClauses.push(`b.plan_production_date <= ?`);
            queryParams.push(`${toPlanDate} 23:59:59`);
        }

        // 2. Filter Actual Production Date (Aman dari NULL)
        if (fromActualDate) {
            whereClauses.push(`(b.actual_production_date IS NOT NULL AND b.actual_production_date >= ?)`);
            queryParams.push(`${fromActualDate} 00:00:00`);
        }
        if (toActualDate) {
            whereClauses.push(`(b.actual_production_date IS NOT NULL AND b.actual_production_date <= ?)`);
            queryParams.push(`${toActualDate} 23:59:59`);
        }

        // 3. Filter PO Created Date
        if (fromCreatedDate) {
            whereClauses.push(`h.created_at >= ?`);
            queryParams.push(`${fromCreatedDate} 00:00:00`);
        }
        if (toCreatedDate) {
            whereClauses.push(`h.created_at <= ?`);
            queryParams.push(`${toCreatedDate} 23:59:59`);
        }

        // 4. Filter PO Req. Delivery Date
        if (fromDeliveryDate) {
            whereClauses.push(`h.requested_delivery_date >= ?`);
            queryParams.push(`${fromDeliveryDate} 00:00:00`);
        }
        if (toDeliveryDate) {
            whereClauses.push(`h.requested_delivery_date <= ?`);
            queryParams.push(`${toDeliveryDate} 23:59:59`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const orderBySql = buildOrderByClause(displayMode, sortKey, sortOrder);

        if (displayMode === 'BY_PO') {
            // MODE: BY PO NUMBER
            const countQuery = `
                SELECT COUNT(DISTINCT h.po_header_id) AS total
                FROM sipuro_db.po_headers h
                JOIN sipuro_db.po_details d ON h.po_header_id = d.po_header_id
                JOIN sipuro_db.po_batch_allocations pba ON d.po_detail_id = pba.po_detail_id
                JOIN sipuro_db.batches b ON pba.id_batch = b.id
                JOIN sipuro_db.products p ON b.id_product = p.id_product
                ${whereSql};
            `;
            const [countRows] = await sipuroDb.query(countQuery, queryParams);
            const totalItems = Number(countRows[0]?.total || 0);
            const totalPages = Math.ceil(totalItems / limitNum);

            const query = `
                SELECT 
                    h.po_header_id,
                    h.po_number,
                    h.created_at AS po_created_date,
                    h.requested_delivery_date AS po_requested_delivery_date,
                    SUM(pba.allocated_qty) AS total_allocated_qty,
                    SUM(pba.fulfilled_qty) AS total_fulfilled_qty,
                    GROUP_CONCAT(
                        CONCAT(
                            pba.id, ':', 
                            b.batch_number, ':', 
                            p.product_code, ':', 
                            REPLACE(p.product_name, ':', ' '), ':', 
                            pba.allocated_qty, ':', 
                            pba.fulfilled_qty, ':', 
                            pba.status, ':', 
                            IFNULL(b.plan_production_date, ''), ':', 
                            IFNULL(b.actual_production_date, '')
                        )
                        SEPARATOR '||'
                    ) AS raw_batch_allocations
                FROM sipuro_db.po_headers h
                JOIN sipuro_db.po_details d ON h.po_header_id = d.po_header_id
                JOIN sipuro_db.po_batch_allocations pba ON d.po_detail_id = pba.po_detail_id
                JOIN sipuro_db.batches b ON pba.id_batch = b.id
                JOIN sipuro_db.products p ON b.id_product = p.id_product
                ${whereSql}
                GROUP BY h.po_header_id, h.po_number, h.created_at, h.requested_delivery_date
                ${orderBySql}
                LIMIT ${limitNum} OFFSET ${offset};
            `;

            const [rows] = await sipuroDb.query(query, queryParams);

            const formattedRows = rows.map(row => {
                const batchAllocations = row.raw_batch_allocations
                    ? row.raw_batch_allocations.split('||').map(item => {
                        const [
                            allocation_id,
                            batch_number,
                            product_code,
                            product_name,
                            allocated_qty,
                            fulfilled_qty,
                            status,
                            plan_production_date,
                            actual_production_date
                        ] = item.split(':');

                        return {
                            allocation_id: Number(allocation_id),
                            batch_number,
                            product_code,
                            product_name,
                            allocated_qty: Number(allocated_qty) || 0,
                            fulfilled_qty: Number(fulfilled_qty) || 0,
                            status,
                            plan_production_date: plan_production_date || null,
                            actual_production_date: actual_production_date || null
                        };
                    })
                    : [];

                delete row.raw_batch_allocations;
                return { ...row, batch_allocations: batchAllocations };
            });

            const poToleranceRatio = await getPOTolerance(sipuroDb);
            const poTolerancePercent = poToleranceRatio ? poToleranceRatio * 100 : null;

            return res.json({
                success: true,
                displayMode,
                data: formattedRows,
                poTolerance: poTolerancePercent,
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });

        } else {
            // MODE: BY BATCH NUMBER (DEFAULT)
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
                    b.actual_production_date,
                    p.product_code,
                    p.product_name,
                    SUM(pba.allocated_qty) AS total_allocated_qty,
                    SUM(pba.fulfilled_qty) AS total_fulfilled_qty,
                    GROUP_CONCAT(
                        CONCAT(
                            pba.id, ':', 
                            h.po_number, ':', 
                            pba.allocated_qty, ':', 
                            pba.fulfilled_qty, ':', 
                            pba.status, ':', 
                            IFNULL(h.created_at, ''), ':', 
                            IFNULL(h.requested_delivery_date, '')
                        )
                        SEPARATOR '||'
                    ) AS raw_po_allocations
                FROM sipuro_db.batches b
                JOIN sipuro_db.products p ON b.id_product = p.id_product
                JOIN sipuro_db.po_batch_allocations pba ON b.id = pba.id_batch
                JOIN sipuro_db.po_details d ON pba.po_detail_id = d.po_detail_id
                JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
                ${whereSql}
                GROUP BY b.id, b.batch_number, b.status, b.plan_production_date, b.actual_production_date, p.product_code, p.product_name
                ${orderBySql}
                LIMIT ${limitNum} OFFSET ${offset};
            `;

            const [rows] = await sipuroDb.query(query, queryParams);

            const formattedRows = rows.map(row => {
                const allocations = row.raw_po_allocations
                    ? row.raw_po_allocations.split('||').map(item => {
                        const [
                            allocation_id,
                            po_number,
                            allocated_qty,
                            fulfilled_qty,
                            status,
                            po_created_date,
                            po_requested_delivery_date
                        ] = item.split(':');

                        return {
                            allocation_id: Number(allocation_id),
                            po_number,
                            allocated_qty: Number(allocated_qty) || 0,
                            fulfilled_qty: Number(fulfilled_qty) || 0,
                            status,
                            po_created_date: po_created_date || null,
                            po_requested_delivery_date: po_requested_delivery_date || null
                        };
                    })
                    : [];

                delete row.raw_po_allocations;
                return { ...row, po_allocations: allocations };
            });

            const poToleranceRatio = await getPOTolerance(sipuroDb);
            const poTolerancePercent = poToleranceRatio ? poToleranceRatio * 100 : null;

            return res.json({
                success: true,
                displayMode,
                data: formattedRows,
                poTolerance: poTolerancePercent,
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });
        }
    } catch (error) {
        console.error('Error fetching batch mapping:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch batch mapping history.', error: error.message });
    }
};

// 2. Action Update Status Alokasi Batch (Batalkan / Force Close)
exports.updateAllocationStatus = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        await connection.beginTransaction();

        const { allocationId } = req.params;
        const { action, reason } = req.body;
        const userId = req.user ? req.user.id : null;

        const [[allocation]] = await connection.query(`
            SELECT pba.*, pd.po_header_id 
            FROM sipuro_db.po_batch_allocations pba
            JOIN sipuro_db.po_details pd ON pba.po_detail_id = pd.po_detail_id
            WHERE pba.id = ? FOR UPDATE
        `, [allocationId]);

        if (!allocation) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Allocation data not found.' });
        }

        let newStatus = '';
        if (action === 'CANCEL') {
            if (Number(allocation.fulfilled_qty) > 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Allocation with fulfilled quantity > 0 cannot be canceled.'
                });
            }
            newStatus = 'Canceled';
        } else if (action === 'FORCE_CLOSE') {
            if (Number(allocation.fulfilled_qty) >= Number(allocation.allocated_qty)) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Allocation is already fully fulfilled. Use normal Closed status.'
                });
            }
            newStatus = 'Force Closed';
        } else {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Invalid action type.' });
        }

        await connection.query(
            `UPDATE sipuro_db.po_batch_allocations SET status = ? WHERE id = ?`,
            [newStatus, allocationId]
        );

        // Pencatatan Log UPDATE menggunakan helper baru
        await logAllocationUpdate(connection, {
            allocation_id: allocationId,
            po_detail_id: allocation.po_detail_id,
            id_batch: allocation.id_batch,
            old_fulfilled_qty: allocation.fulfilled_qty || 0,
            new_fulfilled_qty: allocation.fulfilled_qty || 0,
            old_status: allocation.status,
            new_status: newStatus,
            reason: reason || `Manual ${action} action`,
            created_by: userId || allocation.created_by || 1
        });

        await refreshPOStatus(connection, allocation.po_header_id);
        await refreshBatchStatus(connection, allocation.id_batch);

        await connection.commit();
        return res.status(200).json({
            success: true,
            message: `Allocation status successfully updated to ${newStatus}.`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updateAllocationStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error.',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

// 3. Action Update Batch Number (Rename Batch)
exports.updateBatchNumber = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        await connection.beginTransaction();

        const { batchId } = req.params;
        const { newBatchNumber } = req.body;

        // Validasi input
        if (!newBatchNumber || newBatchNumber.trim() === '') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Batch number cannot be empty.'
            });
        }

        const trimmedBatchNumber = newBatchNumber.trim();

        // 1. Cek keberadaan batch & status
        const [[batch]] = await connection.query(`
            SELECT * FROM sipuro_db.batches 
            WHERE id = ? FOR UPDATE
        `, [batchId]);

        if (!batch) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Batch not found.'
            });
        }

        // Hanya batch berstatus Open yang boleh di-rename
        if (batch.status !== 'Open') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Batch with status "${batch.status}" cannot be renamed. Only "Open" batches can be edited.`
            });
        }

        // 2. Cek apakah newBatchNumber sudah dipakai oleh batch lain
        const [[existing]] = await connection.query(`
            SELECT id FROM sipuro_db.batches 
            WHERE batch_number = ? AND id != ?
        `, [trimmedBatchNumber, batchId]);

        if (existing) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Batch number "${trimmedBatchNumber}" already exists. Please use a different number.`
            });
        }

        // 3. Update Batch Number
        await connection.query(`
            UPDATE sipuro_db.batches 
            SET batch_number = ? 
            WHERE id = ?
        `, [trimmedBatchNumber, batchId]);

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: `Batch number successfully updated to "${trimmedBatchNumber}".`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updateBatchNumber:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while updating batch number.',
            error: error.message
        });
    } finally {
        connection.release();
    }
};
