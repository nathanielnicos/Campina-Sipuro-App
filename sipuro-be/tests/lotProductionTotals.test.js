'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getNetProducedQty, getLotBatchCapacity } = require('../services/production-lot/lotProductionTotals');

const fakeConn = (handler) => {
    const calls = [];
    return { calls, query: async (sql, params) => { const s = sql.replace(/\s+/g, ' ').trim(); calls.push({ sql: s, params }); return handler(s, params); } };
};

test('produksi bersih: completion dikurangi return, dengan COLLATE dan jenis return sebagai parameter', async () => {
    const c = fakeConn(() => [[{ net_qty: '70' }]]);
    assert.equal(await getNetProducedQty(c, { batchNumber: 'B1', lotNumber: 'L1', itemCode: 'P1' }), 70);
    assert.match(c.calls[0].sql, /CASE WHEN trans_type = \? THEN -qty_pac ELSE qty_pac END/);
    for (const col of ['batch_number', 'lot_number', 'item_code']) {
        assert.match(c.calls[0].sql, new RegExp(`${col} COLLATE utf8mb4_unicode_ci = \\?`));
    }
    assert.deepEqual(c.calls[0].params, ['WIP Completion Return', 'B1', 'L1', 'P1']);
});

test('tanpa baris upload: nol', async () => {
    assert.equal(await getNetProducedQty(fakeConn(() => [[{ net_qty: 0 }]]), { batchNumber: 'B', lotNumber: 'L', itemCode: 'P' }), 0);
    assert.equal(await getNetProducedQty(fakeConn(() => [[undefined]]), { batchNumber: 'B', lotNumber: 'L', itemCode: 'P' }), 0);
});

test('kapasitas (lot, batch): produksi bersih dikurangi alokasi PO lain (tanpa Canceled), tidak pernah negatif', async () => {
    const mk = (net, others) => fakeConn((s) => {
        if (/FROM lots l JOIN products p ON p.id_product = l.id_product CROSS JOIN batches b/.test(s)) return [[{ lot_number: 'L1', batch_number: 'B1', product_code: 'P1' }]];
        if (/production_lot_upload_details/.test(s)) return [[{ net_qty: net }]];
        return [[{ total: others }]];
    });
    const c = mk(100, 60);
    const cap = await getLotBatchCapacity(c, { lotId: 5, batchId: 11, excludeAllocationId: 9 });
    assert.deepEqual(cap, { netProduced: 100, otherAllocated: 60, available: 40 });
    const others = c.calls.find((x) => /FROM po_lot_allocations/.test(x.sql));
    assert.match(others.sql, /lot_id = \? AND id_batch = \? AND id <> \? AND status <> \?/);
    assert.deepEqual(others.params, [5, 11, 9, 'Canceled']);

    assert.equal((await getLotBatchCapacity(mk(10, 60), { lotId: 5, batchId: 11, excludeAllocationId: 9 })).available, 0);
});

test('lot, batch, atau produk tidak ditemukan: kapasitas nol', async () => {
    const c = fakeConn(() => [[undefined]]);
    assert.deepEqual(await getLotBatchCapacity(c, { lotId: 1, batchId: 1, excludeAllocationId: 1 }), { netProduced: 0, otherAllocated: 0, available: 0 });
});

test('kapasitas memakai produk LOT (bukan produk PO): kode dari lot dipakai mencari produksi bersih', async () => {
    const c = fakeConn((s) => {
        if (/FROM lots l JOIN products p ON p.id_product = l.id_product CROSS JOIN batches b/.test(s)) return [[{ lot_number: 'L1', batch_number: 'B1', product_code: 'FG-OLD' }]];
        if (/production_lot_upload_details/.test(s)) return [[{ net_qty: 50 }]];
        return [[{ total: 0 }]];
    });
    await getLotBatchCapacity(c, { lotId: 5, batchId: 11, excludeAllocationId: 9 });
    const names = c.calls[0];
    assert.deepEqual(names.params, [5, 11]);
    const net = c.calls.find((x) => /production_lot_upload_details/.test(x.sql));
    assert.deepEqual(net.params, ['WIP Completion Return', 'B1', 'L1', 'FG-OLD']);
});
