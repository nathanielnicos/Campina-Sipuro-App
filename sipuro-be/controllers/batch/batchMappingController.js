const { sipuroDb } = require('../../config/db');
const { getPOTolerance, refreshPOStatus, refreshBatchStatus } = require('../../helpers/batchHelper');

// 1. Mapping Batch ke PO (Get List Data)
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
                    CONCAT(pba.id, ':', h.po_number, ':', pba.allocated_qty, ':', pba.fulfilled_qty, ':', pba.status)
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
                    const [allocation_id, po_number, allocated_qty, fulfilled_qty, status] = item.split(':');
                    return {
                        allocation_id: Number(allocation_id),
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

        const poToleranceRatio = await getPOTolerance(sipuroDb);
        const poTolerancePercent = poToleranceRatio ? poToleranceRatio * 100 : null;

        res.json({
            success: true,
            data: formattedRows,
            poTolerance: poTolerancePercent,
            pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
        });
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
        const { action, reason } = req.body; // action: 'CANCEL' atau 'FORCE_CLOSE'
        const userId = req.user ? req.user.id : null;

        // A. Ambil data alokasi & PO Header ID terkait
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

        // B. Update status alokasi
        await connection.query(
            `UPDATE sipuro_db.po_batch_allocations SET status = ? WHERE id = ?`,
            [newStatus, allocationId]
        );

        // C. Catat Log Alokasi
        await connection.query(`
            INSERT INTO sipuro_db.po_batch_allocation_logs 
            (
                allocation_id, 
                po_detail_id, 
                id_batch, 
                action_type, 
                old_fulfilled_qty, 
                new_fulfilled_qty, 
                old_status, 
                new_status, 
                reason,
                created_by, 
                created_at
            )
            VALUES (?, ?, ?, 'UPDATE', ?, ?, ?, ?, ?, ?, NOW())
        `, [
            allocationId,
            allocation.po_detail_id,
            allocation.id_batch,
            allocation.fulfilled_qty || 0,
            allocation.fulfilled_qty || 0,
            allocation.status,
            newStatus,
            reason || `Manual ${action} action`,
            userId || allocation.created_by || 1
        ]);

        // D. Trigger Sinkronisasi Status Induk PO & Status Induk Batch
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
