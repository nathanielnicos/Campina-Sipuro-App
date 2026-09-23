const { sipuroDb } = require('../../../config/db');
const { getPOTolerance } = require('../../../helpers/batchHelper');

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
            fromCreatedDate, toCreatedDate
        } = req.query;

        let whereClauses = ['d.deleted_at IS NULL'];
        let queryParams = [];

        if (search) {
            whereClauses.push(`(b.batch_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR h.po_number LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (batchStatus) {
            whereClauses.push(`b.status = ?`);
            queryParams.push(batchStatus);
        }

        if (fromPlanDate) {
            whereClauses.push(`b.plan_production_date >= ?`);
            queryParams.push(`${fromPlanDate} 00:00:00`);
        }
        if (toPlanDate) {
            whereClauses.push(`b.plan_production_date <= ?`);
            queryParams.push(`${toPlanDate} 23:59:59`);
        }

        if (fromActualDate) {
            whereClauses.push(`(b.actual_production_date IS NOT NULL AND b.actual_production_date >= ?)`);
            queryParams.push(`${fromActualDate} 00:00:00`);
        }
        if (toActualDate) {
            whereClauses.push(`(b.actual_production_date IS NOT NULL AND b.actual_production_date <= ?)`);
            queryParams.push(`${toActualDate} 23:59:59`);
        }

        if (fromCreatedDate) {
            whereClauses.push(`h.created_at >= ?`);
            queryParams.push(`${fromCreatedDate} 00:00:00`);
        }
        if (toCreatedDate) {
            whereClauses.push(`h.created_at <= ?`);
            queryParams.push(`${toCreatedDate} 23:59:59`);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const orderBySql = buildOrderByClause(displayMode, sortKey, sortOrder);

        const poToleranceRatio = await getPOTolerance(sipuroDb) || 1.0;
        const poTolerancePercent = poToleranceRatio * 100;

        if (displayMode === 'BY_PO') {
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
                    SUM(pba.allocated_qty) AS total_allocated_qty,
                    SUM(pba.fulfilled_qty) AS total_fulfilled_qty,
                    GROUP_CONCAT(
                        CONCAT(
                            pba.id, ';;', 
                            b.batch_number, ';;', 
                            p.product_code, ';;', 
                            REPLACE(p.product_name, ';;', ' '), ';;', 
                            pba.allocated_qty, ';;', 
                            pba.fulfilled_qty, ';;', 
                            pba.status, ';;', 
                            IFNULL(b.actual_production_date, ''), ';;', 
                            IFNULL(b.actual_completed_date, ''), ';;',
                            IFNULL(d.base_qty, 0), ';;',
                            IFNULL(d.fulfilled_qty, 0)
                        )
                        SEPARATOR '||'
                    ) AS raw_batch_allocations
                FROM sipuro_db.po_headers h
                JOIN sipuro_db.po_details d ON h.po_header_id = d.po_header_id
                JOIN sipuro_db.po_batch_allocations pba ON d.po_detail_id = pba.po_detail_id
                JOIN sipuro_db.batches b ON pba.id_batch = b.id
                JOIN sipuro_db.products p ON b.id_product = p.id_product
                ${whereSql}
                GROUP BY h.po_header_id, h.po_number, h.created_at
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
                            actual_production_date,
                            actual_completed_date,
                            po_base_qty,
                            po_fulfilled_qty
                        ] = item.split(';;');

                        const baseQtyNum = Number(po_base_qty) || 0;
                        const fulfilledQtyNum = Number(po_fulfilled_qty) || 0;

                        let fulfillmentPercentage = 0;
                        if (baseQtyNum > 0) {
                            fulfillmentPercentage = Number(((fulfilledQtyNum / baseQtyNum) * 100).toFixed(1));
                        }

                        const targetRequiredQty = Math.round(baseQtyNum * poToleranceRatio);
                        const isClosedByTolerance = fulfilledQtyNum >= targetRequiredQty && targetRequiredQty > 0;
                        const calculatedStatus = isClosedByTolerance ? 'Closed' : (status || 'Open');

                        return {
                            allocation_id: Number(allocation_id),
                            batch_number,
                            product_code,
                            product_name,
                            allocated_qty: Number(allocated_qty) || 0,
                            fulfilled_qty: Number(fulfilled_qty) || 0,
                            po_base_qty: baseQtyNum,
                            po_fulfilled_qty: fulfilledQtyNum,
                            fulfillment_percentage: fulfillmentPercentage,
                            status: calculatedStatus,
                            actual_production_date: actual_production_date || null,
                            actual_completed_date: actual_completed_date || null
                        };
                    })
                    : [];

                delete row.raw_batch_allocations;
                return { ...row, batch_allocations: batchAllocations };
            });

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
                    b.actual_production_date,
                    b.actual_completed_date,
                    p.product_code,
                    p.product_name,
                    SUM(pba.allocated_qty) AS total_allocated_qty,
                    SUM(pba.fulfilled_qty) AS total_fulfilled_qty,
                    GROUP_CONCAT(
                        CONCAT(
                            pba.id, ';;', 
                            h.po_number, ';;', 
                            pba.allocated_qty, ';;', 
                            pba.fulfilled_qty, ';;', 
                            pba.status, ';;', 
                            IFNULL(h.created_at, ''), ';;', 
                            IFNULL(d.base_qty, 0), ';;',
                            IFNULL(d.fulfilled_qty, 0)
                        )
                        SEPARATOR '||'
                    ) AS raw_po_allocations
                FROM sipuro_db.batches b
                JOIN sipuro_db.products p ON b.id_product = p.id_product
                JOIN sipuro_db.po_batch_allocations pba ON b.id = pba.id_batch
                JOIN sipuro_db.po_details d ON pba.po_detail_id = d.po_detail_id
                JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
                ${whereSql}
                GROUP BY b.id, b.batch_number, b.status, b.actual_production_date, b.actual_completed_date, p.product_code, p.product_name
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
                            po_base_qty,
                            po_fulfilled_qty
                        ] = item.split(';;');

                        const baseQtyNum = Number(po_base_qty) || 0;
                        const fulfilledQtyNum = Number(po_fulfilled_qty) || 0;

                        let fulfillmentPercentage = 0;
                        if (baseQtyNum > 0) {
                            fulfillmentPercentage = Number(((fulfilledQtyNum / baseQtyNum) * 100).toFixed(1));
                        }

                        const targetRequiredQty = Math.round(baseQtyNum * poToleranceRatio);
                        const isClosedByTolerance = fulfilledQtyNum >= targetRequiredQty && targetRequiredQty > 0;
                        const calculatedStatus = isClosedByTolerance ? 'Closed' : (status || 'Open');

                        return {
                            allocation_id: Number(allocation_id),
                            po_number,
                            allocated_qty: Number(allocated_qty) || 0,
                            fulfilled_qty: Number(fulfilled_qty) || 0,
                            po_base_qty: baseQtyNum,
                            po_fulfilled_qty: fulfilledQtyNum,
                            fulfillment_percentage: fulfillmentPercentage,
                            status: calculatedStatus,
                            po_created_date: po_created_date || null
                        };
                    })
                    : [];

                delete row.raw_po_allocations;
                return { ...row, po_allocations: allocations };
            });

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
