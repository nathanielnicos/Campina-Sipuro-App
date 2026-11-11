'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDeliveryOrderRequest, DISPLAY_MODES } = require('../services/delivery-order/deliveryOrderFilters');
const { fetchDeliveryOrderPage } = require('../services/delivery-order/deliveryOrderQuery');
const { fetchReadyToShipPage, shapeReadyToShip, READY_BASE_SQL } = require('../services/delivery-order/deliveryOrderReadyToShip');

const fakeDb = (answers) => {
    const log = [];
    return {
        log,
        query: async (sql, params) => {
            log.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
            return [answers.shift()];
        }
    };
};

const lotRow = (o = {}) => ({
    lot_id: 1, lot_number: 'L1', id_product: 1, product_code: 'A', product_name: 'Prod A', pcs_per_ctn: 50,
    actual_completed_datetime: '2026-09-01 08:00:00', expired_date: '2028-09-01',
    qty_lot: '1000', net_delivered: '300', balance_pcs: '700', fifo_rank: '1', ...o
});

test('mode READY_TO_SHIP dikenali; pencarian memakai produk dan lot, tanggal tidak dipakai', () => {
    assert.ok(DISPLAY_MODES.includes('READY_TO_SHIP'));
    const req = parseDeliveryOrderRequest({ displayMode: 'READY_TO_SHIP', search: '50%_x', fromDoDate: '2026-10-01' });
    assert.equal(req.displayMode, 'READY_TO_SHIP');
    assert.match(req.whereSql, /x\.product_code LIKE \?/);
    assert.match(req.whereSql, /x\.lot_number LIKE \?/);
    assert.ok(!/do_datetime|dol\./.test(req.whereSql));
    assert.deepEqual(req.params, ['%50\\%\\_x%', '%50\\%\\_x%', '%50\\%\\_x%']);

    const none = parseDeliveryOrderRequest({ displayMode: 'READY_TO_SHIP' });
    assert.equal(none.whereSql, '1 = 1');
    assert.deepEqual(none.params, []);
    // validasi tanggal tetap berlaku
    assert.throws(() => parseDeliveryOrderRequest({ displayMode: 'READY_TO_SHIP', fromDoDate: '2026-12-02', toDoDate: '2026-12-01' }), (e) => e.status === 400);
});

test('query dasar: hanya lot dengan sisa > 0 dan beralokasi, FIFO per produk, status alokasi tidak dipakai', () => {
    assert.match(READY_BASE_SQL, /> 0$/);
    assert.match(READY_BASE_SQL, /status <> 'Canceled'/);
    assert.match(READY_BASE_SQL, /al\.allocated > 0/);
    assert.match(READY_BASE_SQL, /PARTITION BY l\.id_product/);
    assert.match(READY_BASE_SQL, /\(l\.actual_completed_datetime IS NULL\), l\.actual_completed_datetime/);
    assert.match(READY_BASE_SQL, /upload_trans_types/);
    assert.ok(!/status = 'Open'|'Closed'|'Force Closed'/.test(READY_BASE_SQL));
});

test('halaman: hitung, lalu ambil halaman; pencarian di luar hasil FIFO, urutan terlama dulu', async () => {
    const db = fakeDb([[{ total: 25 }], [lotRow(), lotRow({ lot_id: 2, lot_number: 'L2', fifo_rank: '2' })]]);
    const request = parseDeliveryOrderRequest({ displayMode: 'READY_TO_SHIP', search: 'A', page: '3', limit: '10' });
    const { data, totalItems } = await fetchDeliveryOrderPage(db, request);

    assert.equal(totalItems, 25);
    assert.equal(db.log.length, 2);
    assert.match(db.log[0].sql, /^SELECT COUNT\(\*\) AS total FROM \(SELECT l\.id AS lot_id/);
    assert.match(db.log[0].sql, /\) x WHERE \(x\.product_code LIKE \?/);
    assert.match(db.log[1].sql, /ORDER BY \(x\.actual_completed_datetime IS NULL\), x\.actual_completed_datetime ASC, x\.lot_number ASC, x\.lot_id ASC LIMIT \? OFFSET \?/);
    assert.deepEqual(db.log[1].params.slice(-2), [10, 20]);

    assert.deepEqual(data.map((r) => r.rank), [21, 22]);   // menyambung antar halaman
    assert.deepEqual(data.map((r) => r.fifo_rank), [1, 2]);
});

test('hasil kosong: berhenti setelah hitung', async () => {
    const db = fakeDb([[{ total: 0 }]]);
    const out = await fetchReadyToShipPage(db, parseDeliveryOrderRequest({ displayMode: 'READY_TO_SHIP' }));
    assert.deepEqual(out, { data: [], totalItems: 0 });
    assert.equal(db.log.length, 1);
});

test('shapeReadyToShip: angka, carton, field lengkap; produk tanpa pcs per carton -> carton 0', () => {
    const [row] = shapeReadyToShip([lotRow()], 0);
    assert.deepEqual(row, {
        rank: 1, fifo_rank: 1, lot_id: 1, lot_number: 'L1', id_product: 1, product_code: 'A', product_name: 'Prod A',
        actual_completed_datetime: '2026-09-01 08:00:00', expired_date: '2028-09-01',
        qty_lot: 1000, qty_lot_ctn: 20, net_delivered_pcs: 300, net_delivered_ctn: 6, balance_pcs: 700, balance_ctn: 14
    });
    const [noCtn] = shapeReadyToShip([lotRow({ pcs_per_ctn: 0, actual_completed_datetime: null })], 0);
    assert.equal(noCtn.balance_ctn, 0);
    assert.equal(noCtn.actual_completed_datetime, null);
});

test('mode lain tidak berubah: BY_DO tetap lewat query dua langkah', async () => {
    const db = fakeDb([[{ total: 0 }]]);
    await fetchDeliveryOrderPage(db, parseDeliveryOrderRequest({}));
    assert.match(db.log[0].sql, /COUNT\(DISTINCT d\.id\)/);
});
