'use strict';

/**
 * Query daftar mapping Production Lot untuk tiga mode tampilan.
 * Selalu dua langkah: (1) ambil satu halaman kunci induk (PO / batch / nomor lot) yang unik,
 * (2) ambil seluruh anaknya. Dengan begitu pagination menghitung induk, bukan baris join.
 */

const { MAPPING_FROM_SQL } = require('./lotMappingFilters');

const MODES = {
    BY_PO: {
        keyExpr: 'h.po_header_id',
        groupBy: 'h.po_header_id, h.po_number, h.created_at',
        pageOrder: (order, sortKey) => (sortKey === 'po_number'
            ? `h.po_number ${order}, h.po_header_id ASC`
            : `h.created_at ${order}, h.po_header_id ASC`),
        detailOrder: (order) => `h.created_at ${order}, h.po_header_id ASC, d.po_detail_id ASC, b.id ASC, l.actual_completed_datetime ASC, pla.id ASC`,
        select: `h.po_header_id, h.po_number, h.status AS po_header_status, h.created_at AS po_created_date,
                 d.po_detail_id, d.base_qty AS po_base_qty, d.fulfilled_qty AS po_fulfilled_qty,
                 p.id_product, p.product_code, p.product_name,
                 b.id AS batch_id, b.batch_number, b.status AS batch_status,
                 l.id AS lot_id, l.lot_number, l.actual_completed_datetime, l.expired_date,
                 pla.id AS allocation_id, pla.allocated_qty, pla.status AS allocation_status`
    },
    BY_BATCH: {
        keyExpr: 'b.id',
        groupBy: 'b.id',
        pageOrder: (order) => `b.id ${order}`,
        detailOrder: (order) => `b.id ${order}, l.id ASC, pla.id ASC`,
        select: `b.id AS batch_id, b.batch_number, b.status AS batch_status, b.actual_completed_date,
                 p.product_code, p.product_name,
                 l.id AS lot_id, l.lot_number, l.actual_completed_datetime, l.expired_date,
                 pla.id AS allocation_id, pla.allocated_qty, pla.status AS allocation_status,
                 h.po_number`
    },
    BY_LOT: {
        keyExpr: 'l.lot_number',
        groupBy: 'l.lot_number',
        pageOrder: (order) => `l.lot_number ${order}`,
        detailOrder: (order) => `l.lot_number ${order}, b.id ASC, pla.id ASC`,
        select: `l.id AS lot_id, l.lot_number, l.actual_completed_datetime, l.expired_date,
                 b.id AS batch_id, b.batch_number,
                 p.id_product, p.product_code, p.product_name,
                 pla.id AS allocation_id, pla.allocated_qty, pla.status AS allocation_status,
                 h.po_number`
    }
};

// ---------- Perakit hasil (fungsi murni) ----------

const shapeByPo = (rows) => {
    const poMap = new Map();
    rows.forEach((row) => {
        if (!poMap.has(row.po_header_id)) {
            poMap.set(row.po_header_id, {
                po_header_id: row.po_header_id,
                po_number: row.po_number,
                po_status: row.po_header_status,
                po_created_date: row.po_created_date,
                products: new Map()
            });
        }
        const po = poMap.get(row.po_header_id);

        if (!po.products.has(row.po_detail_id)) {
            const baseQty = Number(row.po_base_qty) || 0;
            const fulfilledQty = Number(row.po_fulfilled_qty) || 0;
            po.products.set(row.po_detail_id, {
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
        const product = po.products.get(row.po_detail_id);

        if (!product.batches.has(row.batch_id)) {
            product.batches.set(row.batch_id, {
                batch_id: row.batch_id,
                batch_number: row.batch_number,
                batch_status: row.batch_status,
                lots: []
            });
        }
        product.batches.get(row.batch_id).lots.push({
            allocation_id: row.allocation_id,
            lot_id: row.lot_id,
            lot_number: row.lot_number,
            allocated_qty: Number(row.allocated_qty) || 0,
            status: row.allocation_status,
            actual_completed_datetime: row.actual_completed_datetime,
            expired_date: row.expired_date
        });
    });

    return Array.from(poMap.values()).map((po) => ({
        ...po,
        products: Array.from(po.products.values()).map((product) => ({
            ...product,
            batches: Array.from(product.batches.values())
        }))
    }));
};

const shapeByBatch = (rows) => {
    const batchMap = new Map();
    rows.forEach((r) => {
        if (!batchMap.has(r.batch_id)) {
            batchMap.set(r.batch_id, {
                batch_id: r.batch_id,
                batch_number: r.batch_number,
                batch_status: r.batch_status,
                product_code: r.product_code,
                product_name: r.product_name,
                actual_completed_date: r.actual_completed_date,
                lots: new Map()
            });
        }
        const batch = batchMap.get(r.batch_id);

        if (!batch.lots.has(r.lot_id)) {
            batch.lots.set(r.lot_id, {
                lot_id: r.lot_id,
                lot_number: r.lot_number,
                actual_completed_datetime: r.actual_completed_datetime,
                expired_date: r.expired_date,
                po_allocations: []
            });
        }
        batch.lots.get(r.lot_id).po_allocations.push({
            allocation_id: r.allocation_id,
            po_number: r.po_number,
            allocated_qty: Number(r.allocated_qty) || 0,
            status: r.allocation_status
        });
    });

    return Array.from(batchMap.values()).map((b) => ({ ...b, lots: Array.from(b.lots.values()) }));
};

const shapeByLot = (rows) => {
    const lotMap = new Map();
    rows.forEach((r) => {
        if (!lotMap.has(r.lot_number)) {
            lotMap.set(r.lot_number, { lot_number: r.lot_number, batches: new Map() });
        }
        const lot = lotMap.get(r.lot_number);

        // Satu nomor lot bisa dipakai beberapa produk dan beberapa batch: kunci = batch + produk
        const batchKey = `${r.batch_id}_${r.id_product}`;
        if (!lot.batches.has(batchKey)) {
            lot.batches.set(batchKey, {
                batch_id: r.batch_id,
                batch_number: r.batch_number,
                product_code: r.product_code,
                product_name: r.product_name,
                actual_completed_datetime: r.actual_completed_datetime,
                expired_date: r.expired_date,
                allocations: []
            });
        }
        lot.batches.get(batchKey).allocations.push({
            allocation_id: r.allocation_id,
            po_number: r.po_number,
            allocated_qty: Number(r.allocated_qty) || 0,
            allocation_status: r.allocation_status
        });
    });

    return Array.from(lotMap.values()).map((lot) => ({
        lot_number: lot.lot_number,
        batches: Array.from(lot.batches.values())
    }));
};

const SHAPERS = { BY_PO: shapeByPo, BY_BATCH: shapeByBatch, BY_LOT: shapeByLot };

/**
 * @param {{ query: Function }} db
 * @param {object} request hasil parseMappingRequest
 * @returns {Promise<{ data: object[], totalItems: number }>}
 */
const fetchMappingPage = async (db, request) => {
    const { displayMode, whereSql, params, limit, offset, order, sortKey } = request;
    const mode = MODES[displayMode];

    const [countRows] = await db.query(
        `SELECT COUNT(DISTINCT ${mode.keyExpr}) AS total ${MAPPING_FROM_SQL} WHERE ${whereSql}`,
        params
    );
    const totalItems = Number(countRows[0]?.total || 0);
    if (totalItems === 0) return { data: [], totalItems };

    const [keyRows] = await db.query(
        `SELECT ${mode.keyExpr} AS page_key ${MAPPING_FROM_SQL}
         WHERE ${whereSql}
         GROUP BY ${mode.groupBy}
         ORDER BY ${mode.pageOrder(order, sortKey)}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    const keys = keyRows.map((r) => r.page_key);
    if (keys.length === 0) return { data: [], totalItems };

    const [rows] = await db.query(
        `SELECT ${mode.select} ${MAPPING_FROM_SQL}
         WHERE ${whereSql} AND ${mode.keyExpr} IN (?)
         ORDER BY ${mode.detailOrder(order)}`,
        [...params, keys]
    );

    return { data: SHAPERS[displayMode](rows), totalItems };
};

module.exports = { fetchMappingPage, shapeByPo, shapeByBatch, shapeByLot };
