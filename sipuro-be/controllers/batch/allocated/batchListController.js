const { sipuroDb } = require('../../../config/db');
const { getPOTolerance } = require('../../../helpers/batchHelper');

const buildOrderByClause = (displayMode, sortKey, sortOrder) => {
    const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    const batchSortMap = {
        'batch_number': 'b.batch_number',
        'product_name': 'p.product_name',
        'plan_production_date': 'b.plan_production_date',
        'batch_status': 'b.status'
    };

    const poSortMap = {
        'po_number': 'h.po_number',
        'po_created_date': 'h.created_at'
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

            if (totalItems === 0) {
                return res.json({
                    success: true,
                    displayMode,
                    data: [],
                    poTolerance: poTolerancePercent,
                    pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
                });
            }

            const orderDir = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
            const poSortColumn = {
                'po_created_date': 'h.created_at',
                'po_number': 'h.po_number'
            };

            const headerOrderBy = poSortColumn[sortKey]
                ? `ORDER BY ${poSortColumn[sortKey]} ${orderDir}`
                : `ORDER BY h.po_header_id DESC`;

            const poHeaderQuery = `
                SELECT DISTINCT h.po_header_id, h.po_number, h.created_at, h.status AS po_status
                FROM sipuro_db.po_headers h
                JOIN sipuro_db.po_details d ON h.po_header_id = d.po_header_id
                JOIN sipuro_db.po_batch_allocations pba ON d.po_detail_id = pba.po_detail_id
                JOIN sipuro_db.batches b ON pba.id_batch = b.id
                JOIN sipuro_db.products p ON b.id_product = p.id_product
                ${whereSql}
                ${headerOrderBy}
                LIMIT ${limitNum} OFFSET ${offset};
            `;

            const [poHeaders] = await sipuroDb.query(poHeaderQuery, queryParams);
            const poHeaderIds = poHeaders.map(r => r.po_header_id);

            if (poHeaderIds.length === 0) {
                return res.json({
                    success: true,
                    displayMode,
                    data: [],
                    poTolerance: poTolerancePercent,
                    pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
                });
            }

            const placeholders = poHeaderIds.map(() => '?').join(',');
            const detailQueryParams = [...queryParams, ...poHeaderIds];
            const detailWhereSql = whereSql ? `${whereSql} AND h.po_header_id IN (${placeholders})` : `WHERE h.po_header_id IN (${placeholders})`;

            const query = `
                SELECT 
                    h.po_header_id,
                    h.po_number,
                    h.status AS po_header_status,
                    h.created_at AS po_created_date,
                    d.po_detail_id,
                    d.base_qty AS po_base_qty,
                    d.fulfilled_qty AS po_fulfilled_qty,
                    p.id_product,
                    p.product_code,
                    p.product_name,
                    pba.id AS allocation_id,
                    pba.allocated_qty,
                    pba.status AS allocation_status,
                    b.batch_number,
                    b.actual_production_date,
                    b.actual_completed_date
                FROM sipuro_db.po_headers h
                JOIN sipuro_db.po_details d ON h.po_header_id = d.po_header_id
                JOIN sipuro_db.po_batch_allocations pba ON d.po_detail_id = pba.po_detail_id
                JOIN sipuro_db.batches b ON pba.id_batch = b.id
                JOIN sipuro_db.products p ON b.id_product = p.id_product
                ${detailWhereSql}
                ${orderBySql};
            `;

            const [rows] = await sipuroDb.query(query, detailQueryParams);

            const poMap = new Map();

            rows.forEach(row => {
                if (!poMap.has(row.po_header_id)) {
                    poMap.set(row.po_header_id, {
                        po_header_id: row.po_header_id,
                        po_number: row.po_number,
                        po_status: row.po_header_status,
                        po_created_date: row.po_created_date,
                        products: new Map()
                    });
                }

                const currentPo = poMap.get(row.po_header_id);

                if (!currentPo.products.has(row.po_detail_id)) {
                    const baseQtyNum = Number(row.po_base_qty) || 0;
                    const fulfilledQtyNum = Number(row.po_fulfilled_qty) || 0;
                    const remainingQtyNum = Math.max(0, baseQtyNum - fulfilledQtyNum);

                    let fulfillmentPercentage = 0;
                    if (baseQtyNum > 0) {
                        fulfillmentPercentage = Number(((fulfilledQtyNum / baseQtyNum) * 100).toFixed(1));
                    }

                    currentPo.products.set(row.po_detail_id, {
                        po_detail_id: row.po_detail_id,
                        id_product: row.id_product,
                        product_code: row.product_code,
                        product_name: row.product_name,
                        po_base_qty: baseQtyNum,
                        po_fulfilled_qty: fulfilledQtyNum,
                        remaining_qty: remainingQtyNum,
                        fulfillment_percentage: fulfillmentPercentage,
                        status: row.allocation_status || 'Open', // Properti status produk dikembalikan di sini
                        batches: []
                    });
                }

                const currentProduct = currentPo.products.get(row.po_detail_id);

                // Jika terdapat salah satu alokasi yang 'Closed', perbarui status produk menjadi 'Closed'
                if (row.allocation_status === 'Closed') {
                    currentProduct.status = 'Closed';
                }

                currentProduct.batches.push({
                    allocation_id: Number(row.allocation_id),
                    batch_number: row.batch_number,
                    allocated_qty: Number(row.allocated_qty) || 0,
                    status: row.allocation_status,
                    actual_production_date: row.actual_production_date || null,
                    actual_completed_date: row.actual_completed_date || null
                });
            });

            const formattedRows = Array.from(poMap.values()).map(po => ({
                ...po,
                products: Array.from(po.products.values())
            }));

            return res.json({
                success: true,
                displayMode,
                data: formattedRows,
                poTolerance: poTolerancePercent,
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });

        } else {
            // MODE: BY BATCH NUMBER
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

            if (totalItems === 0) {
                return res.json({
                    success: true,
                    displayMode,
                    data: [],
                    poTolerance: poTolerancePercent,
                    pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
                });
            }

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
                    GROUP_CONCAT(
                        CONCAT(
                            pba.id, ';;', 
                            h.po_number, ';;', 
                            pba.allocated_qty, ';;', 
                            pba.status
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
                            status
                        ] = item.split(';;');

                        return {
                            allocation_id: Number(allocation_id),
                            po_number,
                            allocated_qty: Number(allocated_qty) || 0,
                            status: status || 'Open'
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
