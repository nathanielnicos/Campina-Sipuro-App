'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getNetProducedQty, getLotNetProducedQty, getLotBatchCapacity } = require('../services/production-lot/lotProductionTotals');

const fakeConn = (handler) => {
    const calls = [];
    return { calls, query: async (sql, params) => { const s = sql.replace(/\s+/g, ' ').trim(); calls.push({ sql: s, params }); return handler(s, params); } };
};

test('produksi bersih per batch: tanda dari arah jenis di upload_trans_types, dengan COLLATE', async () => {
    const c = fakeConn(() => [[{ net_qty: '70' }]]);
    assert.equal(await getNetProducedQty(c, { batchNumber: 'B1', lotNumber: 'L1', itemCode: 'P1' }), 70);
    assert.match(c.calls[0].sql, /CASE WHEN t\.direction = 'OUT' THEN -d\.qty_pac ELSE d\.qty_pac END/);
    assert.match(c.calls[0].sql, /LEFT JOIN upload_trans_types t ON t\.scope = 'LOT' AND t\.trans_type COLLATE utf8mb4_unicode_ci = d\.trans_type COLLATE utf8mb4_unicode_ci/);
    for (const col of ['batch_number', 'lot_number', 'item_code']) {
        assert.match(c.calls[0].sql, new RegExp(`d\\.${col} COLLATE utf8mb4_unicode_ci = \\?`));
    }
    assert.deepEqual(c.calls[0].params, ['B1', 'L1', 'P1']);
});

test('produksi bersih per lot: tanpa kondisi batch', async () => {
    const c = fakeConn(() => [[{ net_qty: '55' }]]);
    assert.equal(await getLotNetProducedQty(c, { lotNumber: 'L1', itemCode: 'P1' }), 55);
    assert.doesNotMatch(c.calls[0].sql, /d\.batch_number/);
    assert.match(c.calls[0].sql, /t\.direction = 'OUT'/);
    assert.deepEqual(c.calls[0].params, ['L1', 'P1']);
});

test('tanpa baris upload: nol', async () => {
    assert.equal(await getNetProducedQty(fakeConn(() => [[{ net_qty: 0 }]]), { batchNumber: 'B', lotNumber: 'L', itemCode: 'P' }), 0);
    assert.equal(await getNetProducedQty(fakeConn(() => [[undefined]]), { batchNumber: 'B', lotNumber: 'L', itemCode: 'P' }), 0);
});

test('kapasitas (lot, batch): produksi bersih dikurangi alokasi PO lain (tanpa Canceled), tidak pernah negatif', async () => {
    const mk = (net, others, lotNet = net, lotOthers = others) => fakeConn((s) => {
        if (/FROM lots l JOIN products p ON p.id_product = l.id_product CROSS JOIN batches b/.test(s)) return [[{ lot_number: 'L1', batch_number: 'B1', product_code: 'P1' }]];
        if (/FROM production_lot_upload_details d .* WHERE d\.lot_number/.test(s)) return [[{ net_qty: lotNet }]];
        if (/production_lot_upload_details/.test(s)) return [[{ net_qty: net }]];
        if (/WHERE lot_id = \? AND id_batch = \?/.test(s)) return [[{ total: others }]];
        return [[{ total: lotOthers }]];
    });
    const c = mk(100, 60);
    const cap = await getLotBatchCapacity(c, { lotId: 5, batchId: 11, excludeAllocationId: 9 });
    assert.deepEqual(cap, { netProduced: 100, otherAllocated: 60, lotNetProduced: 100, lotOtherAllocated: 60, available: 40, limitedBy: 'BATCH' });
    const lotOthers = c.calls.find((x) => /FROM po_lot_allocations WHERE lot_id = \? AND id <> \?/.test(x.sql));
    assert.deepEqual(lotOthers.params, [5, 9, 'Canceled']);
    const others = c.calls.find((x) => /FROM po_lot_allocations/.test(x.sql));
    assert.match(others.sql, /lot_id = \? AND id_batch = \? AND id <> \? AND status <> \?/);
    assert.deepEqual(others.params, [5, 11, 9, 'Canceled']);

    assert.equal((await getLotBatchCapacity(mk(10, 60), { lotId: 5, batchId: 11, excludeAllocationId: 9 })).available, 0);
});

test('kapasitas: batas lot (setelah issue sampel) bisa lebih ketat dari batas batch; yang terkecil berlaku', async () => {
    const mk = (net, others, lotNet, lotOthers) => fakeConn((s) => {
        if (/FROM lots l JOIN products p/.test(s)) return [[{ lot_number: 'L1', batch_number: 'B1', product_code: 'P1' }]];
        if (/FROM production_lot_upload_details d .* WHERE d\.lot_number/.test(s)) return [[{ net_qty: lotNet }]];
        if (/production_lot_upload_details/.test(s)) return [[{ net_qty: net }]];
        if (/WHERE lot_id = \? AND id_batch = \?/.test(s)) return [[{ total: others }]];
        return [[{ total: lotOthers }]];
    });
    // batch: 100 - 0 = 100; lot: 264 dibuat - 264 issue = 0 bersih (+ batch lain 200) => 200 - 200 = 0
    const lotTight = await getLotBatchCapacity(mk(100, 0, 70, 40), { lotId: 5, batchId: 11, excludeAllocationId: 9 });
    assert.deepEqual([lotTight.available, lotTight.limitedBy], [30, 'LOT']);
    const batchTight = await getLotBatchCapacity(mk(100, 90, 500, 90), { lotId: 5, batchId: 11, excludeAllocationId: 9 });
    assert.deepEqual([batchTight.available, batchTight.limitedBy], [10, 'BATCH']);
    const none = await getLotBatchCapacity(mk(100, 0, 10, 50), { lotId: 5, batchId: 11, excludeAllocationId: 9 });
    assert.equal(none.available, 0);
});

test('lot, batch, atau produk tidak ditemukan: kapasitas nol', async () => {
    const c = fakeConn(() => [[undefined]]);
    assert.deepEqual(await getLotBatchCapacity(c, { lotId: 1, batchId: 1, excludeAllocationId: 1 }), { netProduced: 0, otherAllocated: 0, lotNetProduced: 0, lotOtherAllocated: 0, available: 0, limitedBy: 'BATCH' });
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
    assert.deepEqual(net.params, ['B1', 'L1', 'FG-OLD']);
    const lotNet = c.calls.find((x) => /production_lot_upload_details d .* WHERE d\.lot_number/.test(x.sql));
    assert.deepEqual(lotNet.params, ['L1', 'FG-OLD']);
});
