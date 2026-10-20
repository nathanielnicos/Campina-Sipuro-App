const { sipuroDb } = require('../../../config/db');

exports.getDeliveryOrderMapping = async (req, res) => {
    try {
        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;

        const {
            search,
            displayMode = 'BY_DO',
            sortKey,
            sortOrder,
            fromDoDate, toDoDate
        } = req.query;

        const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        let whereClauses = [];
        let queryParams = [];

        if (search) {
            whereClauses.push(`(do.do_number LIKE ? OR ph.po_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR l.lot_number LIKE ?)`);
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (fromDoDate) {
            whereClauses.push(`do.pick_up_date >= ?`);
            queryParams.push(fromDoDate);
        }
        if (toDoDate) {
            whereClauses.push(`do.pick_up_date <= ?`);
            queryParams.push(toDoDate);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // ==========================================
        // MODE 1: BY DO (DO Header -> Items -> Lot & PO)
        // ==========================================
        if (displayMode === 'BY_DO') {
            const countQuery = `
                SELECT COUNT(DISTINCT do.do_number) AS total
                FROM delivery_orders do
                JOIN delivery_order_allocations doa ON do.id = doa.delivery_order_id
                JOIN po_lot_allocations pla ON doa.po_lot_allocation_id = pla.id
                JOIN po_details pd ON pla.po_detail_id = pd.po_detail_id
                JOIN po_headers ph ON pd.po_header_id = ph.po_header_id
                JOIN lots l ON pla.lot_id = l.id
                JOIN products p ON do.product_id = p.id_product
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

            const distinctDoQuery = `
                SELECT DISTINCT do.do_number, do.pick_up_date
                FROM delivery_orders do
                JOIN delivery_order_allocations doa ON do.id = doa.delivery_order_id
                JOIN po_lot_allocations pla ON doa.po_lot_allocation_id = pla.id
                JOIN po_details pd ON pla.po_detail_id = pd.po_detail_id
                JOIN po_headers ph ON pd.po_header_id = ph.po_header_id
                JOIN lots l ON pla.lot_id = l.id
                JOIN products p ON do.product_id = p.id_product
                ${whereSql}
                ORDER BY do.pick_up_date ${order}, do.do_number ${order}
                LIMIT ${limitNum} OFFSET ${offset};
            `;
            const [doRows] = await sipuroDb.query(distinctDoQuery, queryParams);
            const doNumbers = doRows.map(r => r.do_number);

            const placeholders = doNumbers.map(() => '?').join(',');
            const detailQueryParams = [...queryParams, ...doNumbers];
            const detailWhereSql = whereSql ? `${whereSql} AND do.do_number IN (${placeholders})` : `WHERE do.do_number IN (${placeholders})`;

            const query = `
                SELECT 
                    do.id AS delivery_order_id,
                    do.do_number,
                    do.pick_up_date,
                    do.customer_po_text,
                    p.id_product,
                    p.product_code,
                    p.product_name,
                    p.pcs_per_ctn,
                    doa.qty_pcs AS allocation_qty_pcs,
                    l.lot_number,
                    ph.po_number,
                    ph.created_at AS po_created_date
                FROM delivery_orders do
                JOIN delivery_order_allocations doa ON do.id = doa.delivery_order_id
                JOIN po_lot_allocations pla ON doa.po_lot_allocation_id = pla.id
                JOIN po_details pd ON pla.po_detail_id = pd.po_detail_id
                JOIN po_headers ph ON pd.po_header_id = ph.po_header_id
                JOIN lots l ON pla.lot_id = l.id
                JOIN products p ON do.product_id = p.id_product
                ${detailWhereSql}
                ORDER BY do.pick_up_date ${order}, do.do_number ASC;
            `;
            const [rows] = await sipuroDb.query(query, detailQueryParams);

            const doMap = new Map();
            rows.forEach(r => {
                if (!doMap.has(r.do_number)) {
                    doMap.set(r.do_number, {
                        do_number: r.do_number,
                        pick_up_date: r.pick_up_date,
                        customer_po_text: r.customer_po_text,
                        total_qty_pcs: 0,
                        items: new Map()
                    });
                }
                const doEntry = doMap.get(r.do_number);
                doEntry.total_qty_pcs += Number(r.allocation_qty_pcs) || 0;

                if (!doEntry.items.has(r.id_product)) {
                    doEntry.items.set(r.id_product, {
                        id_product: r.id_product,
                        product_code: r.product_code,
                        product_name: r.product_name,
                        total_item_qty_pcs: 0,
                        allocations: []
                    });
                }
                const itemEntry = doEntry.items.get(r.id_product);
                itemEntry.total_item_qty_pcs += Number(r.allocation_qty_pcs) || 0;

                itemEntry.allocations.push({
                    po_number: r.po_number,
                    lot_number: r.lot_number,
                    qty_pcs: Number(r.allocation_qty_pcs) || 0,
                    po_created_date: r.po_created_date
                });
            });

            const formattedData = Array.from(doMap.values()).map(d => ({
                ...d,
                items: Array.from(d.items.values())
            }));

            return res.json({
                success: true,
                displayMode,
                data: formattedData,
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });

        // ==========================================
        // MODE 2: BY PO (PO -> Products -> Shipped DOs)
        // ==========================================
        } else if (displayMode === 'BY_PO') {
            const countQuery = `
                SELECT COUNT(DISTINCT ph.po_header_id) AS total
                FROM po_headers ph
                JOIN po_details pd ON ph.po_header_id = pd.po_header_id
                JOIN po_lot_allocations pla ON pd.po_detail_id = pla.po_detail_id
                JOIN delivery_order_allocations doa ON pla.id = doa.po_lot_allocation_id
                JOIN delivery_orders do ON doa.delivery_order_id = do.id
                JOIN products p ON pd.id_product = p.id_product
                JOIN lots l ON pla.lot_id = l.id
                ${whereSql};
            `;
            const [countRows] = await sipuroDb.query(countQuery, queryParams);
            const totalItems = Number(countRows[0]?.total || 0);
            const totalPages = Math.ceil(totalItems / limitNum);

            const query = `
                SELECT 
                    ph.po_header_id,
                    ph.po_number,
                    ph.status AS po_status,
                    ph.created_at AS po_created_date,
                    pd.po_detail_id,
                    pd.base_qty,
                    pd.fulfilled_qty,
                    pd.delivered_qty,
                    p.product_code,
                    p.product_name,
                    do.do_number,
                    do.pick_up_date,
                    l.lot_number,
                    doa.qty_pcs AS shipped_qty_pcs
                FROM po_headers ph
                JOIN po_details pd ON ph.po_header_id = pd.po_header_id
                JOIN po_lot_allocations pla ON pd.po_detail_id = pla.po_detail_id
                JOIN delivery_order_allocations doa ON pla.id = doa.po_lot_allocation_id
                JOIN delivery_orders do ON doa.delivery_order_id = do.id
                JOIN products p ON pd.id_product = p.id_product
                JOIN lots l ON pla.lot_id = l.id
                ${whereSql}
                ORDER BY ph.created_at ${order}
                LIMIT ${limitNum} OFFSET ${offset};
            `;
            const [rows] = await sipuroDb.query(query, queryParams);

            const poMap = new Map();
            rows.forEach(r => {
                if (!poMap.has(r.po_header_id)) {
                    poMap.set(r.po_header_id, {
                        po_header_id: r.po_header_id,
                        po_number: r.po_number,
                        po_status: r.po_status,
                        po_created_date: r.po_created_date,
                        products: new Map()
                    });
                }
                const poEntry = poMap.get(r.po_header_id);

                if (!poEntry.products.has(r.po_detail_id)) {
                    poEntry.products.set(r.po_detail_id, {
                        po_detail_id: r.po_detail_id,
                        product_code: r.product_code,
                        product_name: r.product_name,
                        base_qty: Number(r.base_qty) || 0,
                        fulfilled_qty: Number(r.fulfilled_qty) || 0,
                        delivered_qty: Number(r.delivered_qty) || 0,
                        remaining_to_deliver: Math.max(0, (Number(r.fulfilled_qty) || 0) - (Number(r.delivered_qty) || 0)),
                        deliveries: []
                    });
                }
                poEntry.products.get(r.po_detail_id).deliveries.push({
                    do_number: r.do_number,
                    pick_up_date: r.pick_up_date,
                    lot_number: r.lot_number,
                    qty_pcs: Number(r.shipped_qty_pcs) || 0
                });
            });

            const formattedData = Array.from(poMap.values()).map(po => ({
                ...po,
                products: Array.from(po.products.values())
            }));

            return res.json({
                success: true,
                displayMode,
                data: formattedData,
                pagination: { totalItems, totalPages, currentPage: pageNum, limit: limitNum }
            });

        // ==========================================
        // MODE 3: BY LOT (Lot Shipped Traceability)
        // ==========================================
        } else {
            const countQuery = `
                SELECT COUNT(DISTINCT l.id) AS total
                FROM lots l
                JOIN po_lot_allocations pla ON l.id = pla.lot_id
                JOIN delivery_order_allocations doa ON pla.id = doa.po_lot_allocation_id
                JOIN delivery_orders do ON doa.delivery_order_id = do.id
                JOIN products p ON do.product_id = p.id_product
                JOIN po_details pd ON pla.po_detail_id = pd.po_detail_id
                JOIN po_headers ph ON pd.po_header_id = ph.po_header_id
                ${whereSql};
            `;
            const [countRows] = await sipuroDb.query(countQuery, queryParams);
            const totalItems = Number(countRows[0]?.total || 0);
            const totalPages = Math.ceil(totalItems / limitNum);

            const query = `
                SELECT 
                    l.id AS lot_id,
                    l.lot_number,
                    p.product_code,
                    p.product_name,
                    l.actual_completed_datetime,
                    l.expired_date,
                    SUM(doa.qty_pcs) AS total_shipped_qty,
                    GROUP_CONCAT(CONCAT(do.do_number, ' -> ', ph.po_number, ' (', doa.qty_pcs, ' pcs)') SEPARATOR ' | ') AS shipment_summary
                FROM lots l
                JOIN po_lot_allocations pla ON l.id = pla.lot_id
                JOIN delivery_order_allocations doa ON pla.id = doa.po_lot_allocation_id
                JOIN delivery_orders do ON doa.delivery_order_id = do.id
                JOIN products p ON do.product_id = p.id_product
                JOIN po_details pd ON pla.po_detail_id = pd.po_detail_id
                JOIN po_headers ph ON pd.po_header_id = ph.po_header_id
                ${whereSql}
                GROUP BY l.id, l.lot_number, p.product_code, p.product_name, l.actual_completed_datetime, l.expired_date
                ORDER BY l.actual_completed_datetime ${order}
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
        console.error('Error fetching DO mapping list:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch DO mapping list.', error: error.message });
    }
};
