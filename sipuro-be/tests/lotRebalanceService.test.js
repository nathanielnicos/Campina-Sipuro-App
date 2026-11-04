'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

// Muatan tiruan: loader dan persist diganti, sehingga yang diuji adalah alur service
let loaded = null;
const persistCalls = [];
const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request === './lotRebalanceLoader') return { loadRebalanceInput: async (...a) => { loaded = a; return currentInput(); } };
    if (request === './lotAllocationPersist') return { persistAllocationItems: async (conn, args) => { persistCalls.push(args); return { allocationCount: args.items.size }; } };
    return originalLoad.apply(this, arguments);
};
const { lotBatchKey } = require('../services/production-lot/lotAllocationRules');
const svc = require(path.join('..', 'services/production-lot/lotRebalanceService'));
const { BusinessError } = require('../helpers/businessError');

const po = (id, created, over = {}) => ({
    po_detail_id: id, po_header_id: id, id_product: 1, base_qty: 100, fulfilled_qty: 0, detail_status: 'Active',
    po_number: `PO${id}`, created_at: created, header_status: 'Approved', product_code: 'P1', product_name: 'P1', ...over
});
const alloc = (id, p, lot, batch, qty, status = 'Open') => ({ id, po_detail_id: p, lot_id: lot, id_batch: batch, allocated_qty: qty, status });
let allocs;
let patch = null;
const currentInput = () => { const input = baseInput(); if (patch) patch(input); return input; };
const baseInput = () => ({
    productId: 1,
    allocations: allocs,
    lots: [{ id: 1, lot_number: 'A', id_product: 1, actual_completed_datetime: '2026-02-01 10:00:00' }, { id: 2, lot_number: 'B', id_product: 1, actual_completed_datetime: '2026-02-02 10:00:00' }],
    batches: [{ id: 11, batch_number: 'B1', id_product: 1 }, { id: 12, batch_number: 'B2', id_product: 1 }],
    openPoDetails: [po(1, '2026-01-01 08:00:00', { fulfilled_qty: 60 }), po(2, '2026-01-02 08:00:00', { fulfilled_qty: 100 })],
    allProducts: [{ id_product: 1, product_code: 'P1', product_name: 'P1' }], productMappings: [], manualDeltas: new Map(),
    netByLotBatch: new Map([[lotBatchKey(1, 11), 60], [lotBatchKey(2, 12), 100]]), netByLot: new Map([[1, 60], [2, 100]]),
    firstCompleted: new Map([[lotBatchKey(1, 11), '2026-02-01 10:00:00'], [lotBatchKey(2, 12), '2026-02-02 10:00:00']]),
    lotDelivered: new Map()
});
const reset = () => { allocs = [alloc(1, 1, 1, 11, 60), alloc(2, 2, 2, 12, 100, 'Closed')]; persistCalls.length = 0; loaded = null; patch = null; };

test('parseProductId, parseFingerprint', () => {
    assert.equal(svc.parseProductId('5'), 5);
    assert.throws(() => svc.parseProductId('x'), BusinessError);
    assert.throws(() => svc.parseFingerprint('abc'), (e) => e instanceof BusinessError && e.status === 400);
    assert.equal(svc.parseFingerprint('a'.repeat(64)), 'a'.repeat(64));
});

test('pratinjau: hasil + sidik jari, tidak menyimpan', async () => {
    reset();
    const r = await svc.previewRebalance({}, { productId: 1 });
    assert.equal(r.canApply, true);
    assert.match(r.fingerprint, /^[0-9a-f]{64}$/);
    assert.equal(persistCalls.length, 0);
    assert.equal(loaded[2], undefined); // tanpa forUpdate
});

test('commit: sidik jari cocok -> persist dengan langkah riwayat dan status', async () => {
    reset();
    const { fingerprint } = await svc.previewRebalance({}, { productId: 1 });
    const r = await svc.commitRebalance({}, { productId: 1, fingerprint, reason: 'fix hole', userId: 7 });
    assert.deepEqual(loaded[2], { forUpdate: true });
    assert.equal(persistCalls.length, 1);
    const call = persistCalls[0];
    assert.equal(call.userId, 7);
    assert.equal(call.reason, 'fix hole');
    const items = [...call.items.values()];
    assert.deepEqual(items.map((i) => [i.poDetailId, i.lotId, i.addedQty, i.rowStatus, i.transTypes]),
        [[1, 2, 40, 'Closed', ['Allocation Shift']], [2, 2, -40, 'Open', ['Allocation Shift']]]);
    assert.equal(r.changedAllocationCount, 2);
    assert.equal(r.poItemStatusChangeCount, 2);
});

test('commit: sidik jari berbeda -> 409 dan tidak menyimpan', async () => {
    reset();
    const { fingerprint } = await svc.previewRebalance({}, { productId: 1 });
    // data berubah setelah pratinjau: lot B kini hanya 90
    allocs = [alloc(1, 1, 1, 11, 60), alloc(2, 2, 2, 12, 90)];
    patch = (input) => { input.openPoDetails[1].fulfilled_qty = 90; input.netByLotBatch.set(lotBatchKey(2, 12), 90); input.netByLot.set(2, 90); };
    await assert.rejects(() => svc.commitRebalance({}, { productId: 1, fingerprint, reason: 'x', userId: 1 }), (e) => e instanceof BusinessError && e.status === 409);
    assert.equal(persistCalls.length, 0);
});

test('commit: ada penghalang -> 422 dengan daftar alasan', async () => {
    reset();
    // edit manual -20 pada lot B: pembatalannya memulihkan 120, melebihi produksi bersih 80
    patch = (input) => { input.manualDeltas = new Map([[2, -20]]); input.netByLotBatch.set(lotBatchKey(2, 12), 80); input.netByLot.set(2, 80); };
    allocs = [alloc(1, 1, 1, 11, 60), alloc(2, 2, 2, 12, 100, 'Closed')];
    await assert.rejects(
        () => svc.commitRebalance({}, { productId: 1, fingerprint: 'a'.repeat(64), reason: 'x', userId: 1 }),
        (e) => e instanceof BusinessError && e.status === 422 && e.details && e.details.problems.length > 0
    );
    assert.equal(persistCalls.length, 0);
});

test('commit: tidak ada yang perlu digeser -> 400', async () => {
    reset();
    // PO1 sudah penuh oleh lot A, PO2 oleh lot B
    allocs = [alloc(1, 1, 1, 11, 100, 'Closed'), alloc(2, 2, 2, 12, 100, 'Closed')];
    patch = (input) => { input.openPoDetails[0].fulfilled_qty = 100; input.netByLotBatch.set(lotBatchKey(1, 11), 100); input.netByLot.set(1, 100); };
    const p = await svc.previewRebalance({}, { productId: 1 });
    assert.equal(p.noChange, true);
    await assert.rejects(() => svc.commitRebalance({}, { productId: 1, fingerprint: p.fingerprint, reason: 'x', userId: 1 }), (e) => e.status === 400);
    assert.equal(persistCalls.length, 0);
});

test('daftar produk: hanya produk yang punya lot, dibatasi 500', async () => {
    let seen = null;
    const rows = await svc.listRebalanceProducts({ query: async (sql, params) => { seen = [sql.replace(/\s+/g, ' '), params]; return [[{ id_product: 1 }]]; } });
    assert.deepEqual(rows, [{ id_product: 1 }]);
    assert.match(seen[0], /EXISTS \(SELECT 1 FROM lots l WHERE l\.id_product = p\.id_product\)/);
    assert.deepEqual(seen[1], [500]);
});
