'use strict';

/**
 * Query daftar Delivery Order untuk tiga tampilan.
 * Selalu dua langkah: (1) ambil satu halaman kunci induk yang unik (nomor DO / nomor lot / nomor retur),
 * (2) ambil seluruh barisnya. Dengan begitu pagination menghitung induk, bukan baris join.
 * Filter pencarian dan tanggal ikut dipasang di langkah 2, sehingga baris yang tampil sesuai filter.
 */

const { DO_FROM_SQL, RETURN_FROM_SQL } = require('./deliveryOrderFilters');

const num = (value) => Number(value) || 0;

// ---------- Perakit hasil (fungsi murni) ----------

// DO -> item -> lot (frontend memilih tingkat Summary atau Detail)
const shapeByDo = (rows) => {
    const doMap = new Map();
    rows.forEach((row) => {
        if (!doMap.has(row.delivery_order_id)) {
            doMap.set(row.delivery_order_id, {
                delivery_order_id: row.delivery_order_id,
                do_number: row.do_number,
                do_datetime: row.do_datetime,
                items: new Map()
            });
        }
        const order = doMap.get(row.delivery_order_id);

        if (!order.items.has(row.id_product)) {
            order.items.set(row.id_product, {
                id_product: row.id_product,
                product_code: row.product_code,
                product_name: row.product_name,
                date_time: row.lot_datetime,
                total_qty_pcs: 0,
                total_qty_ctn: 0,
                lots: []
            });
        }
        const item = order.items.get(row.id_product);
        const qtyPcs = num(row.qty_pcs);
        const qtyCtn = num(row.qty_ctn);

        item.total_qty_pcs += qtyPcs;
        item.total_qty_ctn = Math.round((item.total_qty_ctn + qtyCtn) * 100) / 100;
        if (row.lot_datetime < item.date_time) item.date_time = row.lot_datetime;
        item.lots.push({ lot_number: row.lot_number, date_time: row.lot_datetime, qty_pcs: qtyPcs, qty_ctn: qtyCtn });
    });

    return Array.from(doMap.values()).map((order) => ({ ...order, items: Array.from(order.items.values()) }));
};

const shapeByLot = (rows) => rows.map((row) => ({
    lot_number: row.lot_number,
    id_product: row.id_product,
    product_code: row.product_code,
    product_name: row.product_name,
    actual_completed_datetime: row.actual_completed_datetime,
    expired_date: row.expired_date,
    delivery_order_id: row.delivery_order_id,
    do_number: row.do_number,
    do_datetime: row.do_datetime,
    qty_pcs: num(row.qty_pcs),
    qty_ctn: num(row.qty_ctn)
}));

const shapeByReturn = (rows) => rows.map((row) => ({
    return_id: row.return_id,
    return_number: row.return_number,
    return_datetime: row.return_datetime,
    lot_number: row.lot_number,
    id_product: row.id_product,
    product_code: row.product_code,
    product_name: row.product_name,
    qty_pcs: num(row.qty_pcs),
    qty_ctn: num(row.qty_ctn)
}));

// ---------- Definisi per tampilan ----------

const MODES = {
    BY_DO: {
        fromSql: DO_FROM_SQL,
        keyExpr: 'd.id',
        pageSql: (order) => `SELECT d.id AS key_id ${DO_FROM_SQL}`
            + ` WHERE {WHERE} GROUP BY d.id, d.do_datetime ORDER BY d.do_datetime ${order}, d.id ${order} LIMIT ? OFFSET ?`,
        detailSql: (order) => `SELECT d.id AS delivery_order_id, d.do_number, d.do_datetime,
                p.id_product, p.product_code, p.product_name, dol.lot_number,
                SUM(dol.qty_pcs) AS qty_pcs, SUM(dol.qty_ctn) AS qty_ctn, MIN(dol.do_datetime) AS lot_datetime
            ${DO_FROM_SQL}
            WHERE {WHERE} AND d.id IN (?)
            GROUP BY d.id, d.do_number, d.do_datetime, p.id_product, p.product_code, p.product_name, dol.lot_number
            ORDER BY d.do_datetime ${order}, d.id ${order}, p.product_code ASC, dol.lot_number ASC`,
        shape: shapeByDo
    },
    BY_LOT: {
        fromSql: DO_FROM_SQL,
        keyExpr: 'dol.lot_number',
        pageSql: (order) => `SELECT dol.lot_number AS key_id ${DO_FROM_SQL}`
            + ` WHERE {WHERE} GROUP BY dol.lot_number ORDER BY dol.lot_number ${order} LIMIT ? OFFSET ?`,
        detailSql: (order) => `SELECT dol.lot_number, p.id_product, p.product_code, p.product_name,
                d.id AS delivery_order_id, d.do_number,
                MIN(dol.do_datetime) AS do_datetime,
                SUM(dol.qty_pcs) AS qty_pcs, SUM(dol.qty_ctn) AS qty_ctn,
                (SELECT MIN(l.actual_completed_datetime) FROM lots l WHERE l.lot_number = dol.lot_number) AS actual_completed_datetime,
                (SELECT MIN(l.expired_date) FROM lots l WHERE l.lot_number = dol.lot_number) AS expired_date
            ${DO_FROM_SQL}
            WHERE {WHERE} AND dol.lot_number IN (?)
            GROUP BY dol.lot_number, p.id_product, p.product_code, p.product_name, d.id, d.do_number
            ORDER BY dol.lot_number ${order}, p.product_code ASC, MIN(dol.do_datetime) ASC, d.do_number ASC`,
        shape: shapeByLot
    },
    BY_RETURN: {
        fromSql: RETURN_FROM_SQL,
        keyExpr: 'r.return_number',
        pageSql: (order) => `SELECT r.return_number AS key_id ${RETURN_FROM_SQL}`
            + ` WHERE {WHERE} GROUP BY r.return_number ORDER BY MIN(r.return_datetime) ${order}, r.return_number ${order} LIMIT ? OFFSET ?`,
        detailSql: (order) => `SELECT r.id AS return_id, r.return_number, r.return_datetime, r.lot_number,
                p.id_product, p.product_code, p.product_name, r.qty_pcs, r.qty_ctn
            ${RETURN_FROM_SQL}
            WHERE {WHERE} AND r.return_number IN (?)
            ORDER BY r.return_datetime ${order}, r.return_number ${order}, p.product_code ASC, r.lot_number ASC, r.id ASC`,
        shape: shapeByReturn
    }
};

const withWhere = (sql, whereSql) => sql.replace('{WHERE}', whereSql);

/**
 * @param {{ displayMode, whereSql, params, limit, offset, order }} request hasil parseDeliveryOrderRequest
 * @returns {Promise<{ data: Array, totalItems: number }>}
 */
const fetchDeliveryOrderPage = async (queryable, request) => {
    const mode = MODES[request.displayMode];
    const { whereSql, params, limit, offset, order } = request;

    const [[countRow]] = await queryable.query(
        `SELECT COUNT(DISTINCT ${mode.keyExpr}) AS total ${mode.fromSql} WHERE ${whereSql}`,
        params
    );
    const totalItems = num(countRow && countRow.total);
    if (totalItems === 0) return { data: [], totalItems };

    const [pageRows] = await queryable.query(
        withWhere(mode.pageSql(order), whereSql),
        [...params, limit, offset]
    );
    const keys = pageRows.map((r) => r.key_id);
    if (keys.length === 0) return { data: [], totalItems };

    const [rows] = await queryable.query(
        withWhere(mode.detailSql(order), whereSql),
        [...params, keys]
    );

    return { data: mode.shape(rows), totalItems };
};

module.exports = { fetchDeliveryOrderPage, shapeByDo, shapeByLot, shapeByReturn };
