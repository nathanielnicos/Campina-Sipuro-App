'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadDeliveryOrderContext } = require('../services/delivery-order/deliveryOrderContextLoader');
const { fetchLotStock } = require('../services/delivery-order/deliveryOrderTotals');
const { stockKey } = require('../services/delivery-order/deliveryOrderRules');

const makeDb = () => {
    const log = [];
    return {
        log,
        query: async (sql, params) => {
            const text = sql.replace(/\s+/g, ' ').trim();
            log.push({ text, params });
            if (/FROM products$/.test(text)) return [[{ id_product: 1, product_code: 'A', product_name: 'Prod A', pcs_per_ctn: 10 }]];
            if (/FROM delivery_order_upload_details/.test(text)) return [[{ row_hash: 'h1' }]];
            if (/SELECT DISTINCT lot_number FROM lots/.test(text)) return [[{ lot_number: 'L1' }]];
            if (/FROM po_lot_allocations pla JOIN po_details/.test(text)) return [[{ product_code: 'A', lot_number: 'L1', total_qty: '1000' }]];
            if (/FROM delivery_order_lots t/.test(text)) return [[{ product_code: 'A', lot_number: 'L1', total_qty: '300' }]];
            if (/FROM delivery_returns t/.test(text)) return [[{ product_code: 'A', lot_number: 'L1', total_qty: '20' }]];
            return [[]];
        }
    };
};

test('fetchLotStock: total alokasi (non-Canceled), terkirim, dan retur per (item, lot)', async () => {
    const db = makeDb();
    const stock = await fetchLotStock(db, ['L1', 'L1', '']);
    assert.equal(stock.allocated.get(stockKey('A', 'L1')), 1000);
    assert.equal(stock.delivered.get(stockKey('A', 'L1')), 300);
    assert.equal(stock.returned.get(stockKey('A', 'L1')), 20);
    const allocQuery = db.log.find((q) => /po_lot_allocations pla/.test(q.text));
    assert.match(allocQuery.text, /pla\.status <> 'Canceled'/);
    assert.match(allocQuery.text, /d\.deleted_at IS NULL/);
    assert.deepEqual(allocQuery.params, [['L1']]);
});

test('fetchLotStock: tanpa nomor lot tidak menjalankan query', async () => {
    const db = makeDb();
    const stock = await fetchLotStock(db, []);
    assert.equal(db.log.length, 0);
    assert.equal(stock.allocated.size, 0);
});

test('preview (tanpa lock): tidak ada FOR UPDATE; hash, lot, dan total dimuat', async () => {
    const db = makeDb();
    const ctx = await loadDeliveryOrderContext(db, [{ rowHash: 'h1', lotNumber: 'L1' }, { rowHash: 'h2', lotNumber: 'L1' }]);
    assert.deepEqual(ctx.existingHashes, ['h1']);
    assert.ok(ctx.stock.lotsFound.has('L1'));
    assert.equal(ctx.allProducts.length, 1);
    assert.ok(db.log.every((q) => !/FOR UPDATE/.test(q.text)));
});

test('commit (forUpdate): alokasi lot dikunci berurutan id SEBELUM total dibaca', async () => {
    const db = makeDb();
    await loadDeliveryOrderContext(db, [{ rowHash: 'h1', lotNumber: 'L1' }], { forUpdate: true });
    const lockIdx = db.log.findIndex((q) => /FOR UPDATE/.test(q.text));
    const sumIdx = db.log.findIndex((q) => /SUM\(pla\.allocated_qty\)/.test(q.text));
    assert.ok(lockIdx >= 0 && sumIdx > lockIdx);
    assert.match(db.log[lockIdx].text, /ORDER BY pla\.id FOR UPDATE/);
});
