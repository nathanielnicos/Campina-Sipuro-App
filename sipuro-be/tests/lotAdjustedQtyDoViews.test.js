'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDeliveryOrderRequest, parseDeliveryOrderExportRequest } = require('../services/delivery-order/deliveryOrderFilters');
const { fetchDeliveryOrderPage } = require('../services/delivery-order/deliveryOrderQuery');
const { READY_BASE_SQL } = require('../services/delivery-order/deliveryOrderReadyToShip');
const { fetchExportData } = require('../services/delivery-order/deliveryOrderExportQuery');

// Qty lot di tab Lot Number, Ready to Ship dan ekspor = produksi bersih upload + lots.adjusted_qty

test('tab Lot Number: Qty Lot = produksi bersih + lots.adjusted_qty', async () => {
    const log = [];
    const answers = [[{ total: 1 }], [{ key_id: 'L1' }], [], []];
    const db = { query: async (sql, params) => { log.push({ sql: sql.replace(/\s+/g, ' ').trim(), params }); return [answers.shift()]; } };
    await fetchDeliveryOrderPage(db, parseDeliveryOrderRequest({ displayMode: 'BY_LOT' }));
    const lotInfo = log[3].sql;
    assert.match(lotInfo, /COALESCE\(MAX\(pr\.net_all\), 0\) \+ COALESCE\(MAX\(l\.adjusted_qty\), 0\) AS qty_lot/);
    assert.match(lotInfo, /FROM lots l/);
});

test('Ready to Ship: Qty Lot, saldo, dan syarat sisa > 0 memakai lots.adjusted_qty', () => {
    const sql = READY_BASE_SQL.replace(/\s+/g, ' ');
    assert.match(sql, /COALESCE\(pr\.net_all, 0\) \+ l\.adjusted_qty AS qty_lot/);
    assert.match(sql, /COALESCE\(pr\.net_all, 0\) \+ l\.adjusted_qty - \(COALESCE\(dd\.kirim, 0\) - COALESCE\(rt\.retur, 0\)\) AS balance_pcs/);
    assert.match(sql, /WHERE COALESCE\(pr\.net_all, 0\) \+ l\.adjusted_qty - \(COALESCE\(dd\.kirim, 0\) - COALESCE\(rt\.retur, 0\)\) > 0$/);
});

const exportDb = (state) => ({
    query: async (sql, params) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        state.queries.push({ sql: text, params });
        if (/^SELECT COUNT\(\*\) AS total FROM \(SELECT 1/.test(text)) return [[{ total: 1 }]];
        if (/^SELECT COUNT\(\*\) AS total FROM delivery_returns/.test(text)) return [[{ total: 0 }]];
        if (/^SELECT d\.do_number/.test(text)) return [state.deliveries];
        if (/^SELECT r\.return_number/.test(text)) return [[]];
        if (/FROM production_lot_upload_details/.test(text)) return [state.lotQty];
        if (/FROM product_code_mappings/.test(text)) return [state.mappings];
        if (/^SELECT id_product, product_code FROM products/.test(text)) return [[{ id_product: 1, product_code: 'P1' }, { id_product: 2, product_code: 'P2' }]];
        if (/^SELECT product_code, product_name FROM products/.test(text)) return [[{ product_code: 'P1', product_name: 'Nama P1' }]];
        if (/FROM po_lot_allocations|FROM delivery_order_lots|FROM delivery_returns/.test(text)) return [[]];
        throw new Error(`SQL tak dikenal: ${text}`);
    }
});
const delivery = (o = {}) => ({ do_number: 'DO1', do_datetime: '2026-10-01 08:00:00', product_code: 'P1', product_name: 'Produk 1', lot_number: 'L1', qty_pcs: '30', qty_ctn: '2.5', ...o });

test('ekspor: Lot Qty = produksi bersih + adjusted_qty; query menggabungkan lots lewat kode produk', async () => {
    const state = { queries: [], deliveries: [delivery()], mappings: [], lotQty: [{ lot_number: 'L1', item_code: 'P1', net_all: '100', adjusted_qty: '-30' }] };
    const data = await fetchExportData(exportDb(state), parseDeliveryOrderExportRequest({}));
    assert.equal(data.lotBalance[0].lot_qty, 70);

    const q = state.queries.find((x) => /FROM production_lot_upload_details/.test(x.sql));
    assert.match(q.sql, /COALESCE\(MAX\(l\.adjusted_qty\), 0\) AS adjusted_qty/);
    assert.match(q.sql, /LEFT JOIN lots l ON l\.lot_number COLLATE utf8mb4_unicode_ci = u\.lot_number COLLATE utf8mb4_unicode_ci AND l\.id_product = p\.id_product/);
    assert.match(q.sql, /GROUP BY u\.lot_number, u\.item_code/);
});

test('ekspor: kode lama dan pengganti satu keluarga, penyesuaian ikut dijumlahkan', async () => {
    const state = {
        queries: [], mappings: [{ id_product_old: 1, id_product_new: 2 }],
        deliveries: [delivery({ product_code: 'P1' }), delivery({ do_number: 'DO2', product_code: 'P2' })],
        lotQty: [
            { lot_number: 'L1', item_code: 'P1', net_all: '500', adjusted_qty: '-20' },
            { lot_number: 'L1', item_code: 'P2', net_all: '1000', adjusted_qty: '0' }
        ]
    };
    const data = await fetchExportData(exportDb(state), parseDeliveryOrderExportRequest({}));
    assert.equal(data.lotBalance.length, 1);
    assert.equal(data.lotBalance[0].lot_qty, 1480);
});

test('ekspor: tanpa adjusted_qty (kolom kosong) hasil sama dengan sebelumnya', async () => {
    const state = { queries: [], deliveries: [delivery()], mappings: [], lotQty: [{ lot_number: 'L1', item_code: 'P1', net_all: '120' }] };
    const data = await fetchExportData(exportDb(state), parseDeliveryOrderExportRequest({}));
    assert.equal(data.lotBalance[0].lot_qty, 120);
});
