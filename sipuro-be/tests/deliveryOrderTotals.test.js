'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchLotStock, fetchItemLotBalance } = require('../services/delivery-order/deliveryOrderTotals');
const { stockKey } = require('../services/delivery-order/deliveryOrderRules');

const makeDb = ({ allocated = [], delivered = [], returned = [], lot = { product_code: 'P1', lot_number: 'L1' } } = {}) => ({
    query: async (sql) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        if (/FROM po_lot_allocations pla/.test(text)) return [allocated];
        if (/FROM delivery_order_lots t/.test(text)) return [delivered];
        if (/FROM delivery_returns t/.test(text)) return [returned];
        if (/FROM lots l JOIN products p/.test(text)) return [[lot]];
        if (/FROM product_code_mappings/.test(text)) return [[{ id_product_old: 1, id_product_new: 2 }]];
        if (/^SELECT id_product, product_code FROM products/.test(text)) return [[{ id_product: 1, product_code: 'P1' }, { id_product: 2, product_code: 'P2' }]];
        throw new Error(`SQL tak dikenal: ${text}`);
    }
});
const row = (code, lot, qty) => ({ product_code: code, lot_number: lot, total_qty: String(qty) });

test('terkirim bersih = terkirim - retur; DO 100 lalu retur 100 -> 0', async () => {
    const db = makeDb({ delivered: [row('P1', 'L1', 100)], returned: [row('P1', 'L1', 100)] });
    const out = await fetchLotStock(db, ['L1']);
    assert.equal(out.delivered.get(stockKey('P1', 'L1')), 100);
    assert.equal(out.returned.get(stockKey('P1', 'L1')), 100);
    assert.equal(out.netDelivered.get(stockKey('P1', 'L1')), 0);
});

test('terkirim bersih sebagian dan tidak pernah negatif', async () => {
    const db = makeDb({
        delivered: [row('P1', 'L1', 100), row('P1', 'L2', 10)],
        returned: [row('P1', 'L1', 40), row('P1', 'L2', 30)]
    });
    const out = await fetchLotStock(db, ['L1', 'L2']);
    assert.equal(out.netDelivered.get(stockKey('P1', 'L1')), 60);
    assert.equal(out.netDelivered.get(stockKey('P1', 'L2')), 0);
});

test('tanpa lot: semua peta kosong termasuk netDelivered', async () => {
    const out = await fetchLotStock(makeDb(), []);
    assert.equal(out.netDelivered.size, 0);
});

test('terkirim bersih per keluarga produk: kode lama dan baru dijumlahkan sebelum dikurangi retur', async () => {
    const stockCodes = { forProductCode: () => 'FAM' };
    const db = makeDb({
        delivered: [row('P1', 'L1', 70), row('P2', 'L1', 30)],
        returned: [row('P2', 'L1', 50)]
    });
    const out = await fetchLotStock(db, ['L1'], { stockCodes });
    assert.equal(out.netDelivered.get(stockKey('FAM', 'L1')), 50);
});

test('saldo lot: membawa returned dan netDelivered (dipakai batas perubahan alokasi manual)', async () => {
    const db = makeDb({ allocated: [row('P1', 'L1', 100)], delivered: [row('P1', 'L1', 100)], returned: [row('P2', 'L1', 100)] });
    const balance = await fetchItemLotBalance(db, { lotId: 5 });
    assert.deepEqual(balance, { itemCode: 'P1', lotNumber: 'L1', allocated: 100, delivered: 100, returned: 100, netDelivered: 0 });
});

test('saldo lot: lot tidak ditemukan -> semua nol', async () => {
    const db = makeDb();
    db.query = async () => [[undefined]];
    const balance = await fetchItemLotBalance(db, { lotId: 9 });
    assert.deepEqual(balance, { itemCode: null, lotNumber: null, allocated: 0, delivered: 0, returned: 0, netDelivered: 0 });
});
