'use strict';

/**
 * Total per (kode item PO, nomor lot) untuk modul Delivery Order, dibaca dari database:
 *  - allocated : jumlah allocated_qty alokasi non-Canceled (sama dengan rumus fulfilled_qty, per lot)
 *  - delivered : jumlah qty_pcs di delivery_order_lots
 *  - returned  : jumlah qty_pcs di delivery_returns
 * Dipakai kalkulator upload DO dan aturan "alokasi lot tidak boleh di bawah qty terkirim" di modul lot.
 * Satu-satunya tempat yang mendefinisikan rumus ini.
 */

const { chunk } = require('../../helpers/arrayUtils');
const { NOT_DELETED_SQL } = require('../../helpers/po/openItemRules');
const { ALLOCATION_STATUS } = require('../production-lot/lotAllocationRules');
const { stockKey } = require('./deliveryOrderRules');

const ALLOCATED_SQL = `SELECT p.product_code, l.lot_number, SUM(pla.allocated_qty) AS total_qty
    FROM po_lot_allocations pla
    JOIN po_details d ON pla.po_detail_id = d.po_detail_id
    JOIN lots l ON pla.lot_id = l.id
    JOIN products p ON d.id_product = p.id_product
    WHERE l.lot_number IN (?) AND pla.status <> '${ALLOCATION_STATUS.CANCELED}' AND ${NOT_DELETED_SQL}
    GROUP BY p.product_code, l.lot_number`;

const DELIVERED_SQL = `SELECT p.product_code, t.lot_number, SUM(t.qty_pcs) AS total_qty
    FROM delivery_order_lots t
    JOIN products p ON t.product_id = p.id_product
    WHERE t.lot_number IN (?)
    GROUP BY p.product_code, t.lot_number`;

const RETURNED_SQL = `SELECT p.product_code, t.lot_number, SUM(t.qty_pcs) AS total_qty
    FROM delivery_returns t
    JOIN products p ON t.product_id = p.id_product
    WHERE t.lot_number IN (?)
    GROUP BY p.product_code, t.lot_number`;

const loadTotals = async (queryable, sql, lotNumbers) => {
    const totals = new Map();
    for (const part of chunk(lotNumbers, 500)) {
        const [rows] = await queryable.query(sql, [part]);
        rows.forEach((r) => totals.set(stockKey(r.product_code, r.lot_number), Number(r.total_qty) || 0));
    }
    return totals;
};

/**
 * @param {string[]} lotNumbers nomor lot yang ingin dihitung
 * @returns {Promise<{ allocated: Map, delivered: Map, returned: Map }>} kunci = stockKey(itemCode, lotNumber)
 */
const fetchLotStock = async (queryable, lotNumbers) => {
    const lots = [...new Set(lotNumbers)].filter(Boolean);
    if (lots.length === 0) {
        return { allocated: new Map(), delivered: new Map(), returned: new Map() };
    }
    return {
        allocated: await loadTotals(queryable, ALLOCATED_SQL, lots),
        delivered: await loadTotals(queryable, DELIVERED_SQL, lots),
        returned: await loadTotals(queryable, RETURNED_SQL, lots)
    };
};

/**
 * Saldo satu (item PO, lot): total alokasi non-Canceled dan qty terkirim.
 * Dipakai aturan "alokasi tidak boleh turun di bawah qty terkirim" pada perubahan manual.
 */
const fetchItemLotBalance = async (queryable, { productId, lotId }) => {
    const [[row]] = await queryable.query(
        'SELECT p.product_code, l.lot_number FROM products p JOIN lots l ON l.id = ? WHERE p.id_product = ?',
        [lotId, productId]
    );
    if (!row) return { itemCode: null, lotNumber: null, allocated: 0, delivered: 0 };
    const { allocated, delivered } = await fetchLotStock(queryable, [row.lot_number]);
    const key = stockKey(row.product_code, row.lot_number);
    return {
        itemCode: row.product_code,
        lotNumber: row.lot_number,
        allocated: Number(allocated.get(key)) || 0,
        delivered: Number(delivered.get(key)) || 0
    };
};

module.exports = { fetchLotStock, fetchItemLotBalance };
