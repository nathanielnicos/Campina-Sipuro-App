const { sipuroDb } = require('../../../config/db');
const { getPOTolerance } = require('../../../helpers/lotBatchHelper');

exports.getAllocatedLotMapping = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const {
            search,
            status,
            displayMode = 'BY_PO',
            sortKey,
            sortOrder,
            fromActualDate, toActualDate,
            fromCreatedDate, toCreatedDate
        } = req.query;

        const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        let whereClauses = ['d.deleted_at IS NULL'];
        let queryParams = [];

        if (search) {
            whereClauses.push(`(b.batch_number LIKE ? OR l.lot_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR h.po_number LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status) {
            whereClauses.push(`pla.status = ?`);
            queryParams.push(status);
        }

        if (fromActualDate) {
            whereClauses.push(`l.actual_completed_datetime >= ?`);
            queryParams.push(`${fromActualDate} 00:00:00`);
        }
        if (toActualDate) {
            whereClauses.push(`l.actual_completed_datetime <= ?`);
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
        const poToleranceRatio = await getPOTolerance(sipuroDb) || 1.0;
        const poTolerancePercent = poToleranceRatio * 100;

        // ==========================================
        // MODE 1: BY PO (PO -> Product -> Batch -> Lot)
        // ==========================================
        if (displayMode === 'BY_PO') {
            const countQuery = `
                SELECT COUNT(DISTINCT h.po_header_id) AS total
                FROM po_headers h
                JOIN po_details d ON h.po_header_id = d.po_header_id
                JOIN po_lot_allocations pla ON d.po_detail_id = pla.po_detail_id
                JOIN lots l ON pla.lot_id = l.id
                JOIN batch_lots bl ON l.id = bl.lot_id
                JOIN batches b ON bl.batch_id = b.id
                JOIN products p ON d.id_product = p.id_product
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

            const headerOrderBy = sortKey === 'po_number'
                ? `ORDER BY h.po_number ${order}`
                : `ORDER BY h.created_at ${order}`;

            const poHeaderQuery = `
                SELECT DISTINCT h.po_header_id
                FROM po_headers h
                JOIN po_details d ON h.po_header_id = d.po_header_id
                JOIN po_lot_allocations pla ON d.po_detail_id = pla.po_detail_id
                JOIN lots l ON pla.lot_id = l.id
                JOIN batch_lots bl ON l.id = bl.lot_id
                JOIN batches b ON bl.batch_id = b.id
                JOIN products p ON d.id_product = p.id_product
                ${whereSql}
                ${headerOrderBy}
                LIMIT ${limitNum} OFFSET ${offset};
            `;
            const [poHeaders] = await sipuroDb.query(poHeaderQuery, queryParams);
            const poHeaderIds = poHeaders.map(r => r.po_header_id);

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
                    b.id AS batch_id,
                    b.batch_number,
                    b.status AS batch_status,
                    l.id AS lot_id,
                    l.lot_number,
                    l.actual_completed_datetime,
                    l.expired_date,
                    pla.id AS allocation_id,
                    pla.allocated_qty,
                    pla.status AS allocation_status
                FROM po_headers h
                JOIN po_details d ON h.po_header_id = d.po_header_id
                JOIN po_lot_allocations pla ON d.po_detail_id = pla.po_detail_id
                JOIN lots l ON pla.lot_id = l.id
                JOIN batch_lots bl ON l.id = bl.lot_id
                JOIN batches b ON bl.batch_id = b.id
                JOIN products p ON d.id_product = p.id_product
                ${detailWhereSql}
                ORDER BY h.created_at ${order}, d.po_detail_id ASC, b.id ASC, l.actual_completed_datetime ASC;
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
                const poEntry = poMap.get(row.po_header_id);

                if (!poEntry.products.has(row.po_detail_id)) {
                    const baseQty = Number(row.po_base_qty) || 0;
                    const fulfilledQty = Number(row.po_fulfilled_qty) || 0;
                    poEntry.products.set(row.po_detail_id, {
                        po_detail_id: row.po_detail_id,
                        id_product: row.id_product,
                        product_code: row.product_code,
                        product_name: row.product_name,
                        po_base_qty: baseQty,
                        po_fulfilled_qty: fulfilledQty,
                        remaining_qty: Math.max(0, baseQty - fulfilledQty),
                        fulfillment_percentage: baseQty > 0 ? Number(((fulfilledQty / baseQty) * 100).toFixed(1)) : 0,
                        batches: new Map()
                    });
                }
                const prodEntry = poEntry.products.get(row.po_detail_id);

                if (!prodEntry.batches.has(row.batch_id)) {
                    prodEntry.batches.set(row.batch_id, {
                        batch_id: row.batch_id,
                        batch_number: row.batch_number,
                        batch_status: row.batch_status,
                        lots: []
                    });
                }
                const batchEntry = prodEntry.batches.get(row.batch_id);

                batchEntry.lots.push({
                    allocation_id: row.allocation_id,
                    lot_id: row.lot_id,
                    lot_number: row.lot_number,
                    allocated_qty: Number(row.allocated_qty) || 0,
                    status: row.allocation_status,
                    actual_completed_datetime: row.actual_completed_datetime,
                    expired_date: row.expired_date
                });
            });

            // Format menjadi Array Nested
            const formattedData = Array.from(poMap.values()).map(po => ({
                ...po,
                products: Array.from(po.products.values()).map(prod => ({
                    ...prod,
                    batches: Array.from(prod.batches.values())
                }))
            }));

            return res.json({
                success: true,
                displayMode,
                data: formattedData,
                poTolerance: poTolerancePercent,
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });

            // ==========================================
            // MODE 2: BY BATCH (Batch -> Lot -> PO List)
            // ==========================================
        } else if (displayMode === 'BY_BATCH') {
            const countQuery = `
                SELECT COUNT(DISTINCT b.id) AS total
                FROM batches b
                JOIN products p ON b.id_product = p.id_product
                JOIN batch_lots bl ON b.id = bl.batch_id
                JOIN lots l ON bl.lot_id = l.id
                JOIN po_lot_allocations pla ON l.id = pla.lot_id
                JOIN po_details d ON pla.po_detail_id = d.po_detail_id
                JOIN po_headers h ON d.po_header_id = h.po_header_id
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
                    pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
                });
            }

            const query = `
                SELECT 
                    b.id AS batch_id,
                    b.batch_number,
                    b.status AS batch_status,
                    b.actual_production_date,
                    b.actual_completed_date,
                    p.product_code,
                    p.product_name,
                    l.id AS lot_id,
                    l.lot_number,
                    l.actual_completed_datetime,
                    l.expired_date,
                    pla.id AS allocation_id,
                    pla.allocated_qty,
                    pla.status AS allocation_status,
                    h.po_number
                FROM batches b
                JOIN products p ON b.id_product = p.id_product
                JOIN batch_lots bl ON b.id = bl.batch_id
                JOIN lots l ON bl.lot_id = l.id
                JOIN po_lot_allocations pla ON l.id = pla.lot_id
                JOIN po_details d ON pla.po_detail_id = d.po_detail_id
                JOIN po_headers h ON d.po_header_id = h.po_header_id
                ${whereSql}
                ORDER BY b.id ${order}, l.id ASC
                LIMIT ${limitNum} OFFSET ${offset};
            `;
            const [rows] = await sipuroDb.query(query, queryParams);

            const batchMap = new Map();
            rows.forEach(r => {
                if (!batchMap.has(r.batch_id)) {
                    batchMap.set(r.batch_id, {
                        batch_id: r.batch_id,
                        batch_number: r.batch_number,
                        batch_status: r.batch_status,
                        product_code: r.product_code,
                        product_name: r.product_name,
                        actual_production_date: r.actual_production_date,
                        actual_completed_date: r.actual_completed_date,
                        lots: new Map()
                    });
                }
                const bEntry = batchMap.get(r.batch_id);

                if (!bEntry.lots.has(r.lot_id)) {
                    bEntry.lots.set(r.lot_id, {
                        lot_id: r.lot_id,
                        lot_number: r.lot_number,
                        actual_completed_datetime: r.actual_completed_datetime,
                        expired_date: r.expired_date,
                        po_allocations: []
                    });
                }
                bEntry.lots.get(r.lot_id).po_allocations.push({
                    allocation_id: r.allocation_id,
                    po_number: r.po_number,
                    allocated_qty: Number(r.allocated_qty) || 0,
                    status: r.allocation_status
                });
            });

            const formattedData = Array.from(batchMap.values()).map(b => ({
                ...b,
                lots: Array.from(b.lots.values())
            }));

            return res.json({
                success: true,
                displayMode,
                data: formattedData,
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });

            // ==========================================
            // MODE 3: BY LOT (Lot Flat / Audit View)
            // ==========================================
        } else {
            const countQuery = `
                SELECT COUNT(DISTINCT l.id) AS total
                FROM lots l
                JOIN products p ON l.id_product = p.id_product
                JOIN batch_lots bl ON l.id = bl.lot_id
                JOIN batches b ON bl.batch_id = b.id
                JOIN po_lot_allocations pla ON l.id = pla.lot_id
                JOIN po_details d ON pla.po_detail_id = d.po_detail_id
                JOIN po_headers h ON d.po_header_id = h.po_header_id
                ${whereSql};
            `;
            const [countRows] = await sipuroDb.query(countQuery, queryParams);
            const totalItems = Number(countRows[0]?.total || 0);
            const totalPages = Math.ceil(totalItems / limitNum);

            const query = `
                SELECT 
                    l.id AS lot_id,
                    l.lot_number,
                    l.actual_completed_datetime,
                    l.expired_date,
                    b.batch_number,
                    p.product_code,
                    p.product_name,
                    pla.id AS allocation_id,
                    pla.allocated_qty,
                    pla.status AS allocation_status,
                    h.po_number
                FROM lots l
                JOIN products p ON l.id_product = p.id_product
                JOIN batch_lots bl ON l.id = bl.lot_id
                JOIN batches b ON bl.batch_id = b.id
                JOIN po_lot_allocations pla ON l.id = pla.lot_id
                JOIN po_details d ON pla.po_detail_id = d.po_detail_id
                JOIN po_headers h ON d.po_header_id = h.po_header_id
                ${whereSql}
                ORDER BY l.actual_completed_datetime ${order}, l.id ASC
                LIMIT ${limitNum} OFFSET ${offset};
            `;
            const [rows] = await sipuroDb.query(query, queryParams);

            return res.json({
                success: true,
                displayMode,
                data: rows,
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });
        }
    } catch (error) {
        console.error('Error fetching lot mapping list:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch lot mapping list.', error: error.message });
    }
};
