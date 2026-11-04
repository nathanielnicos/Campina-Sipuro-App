'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRebalance, computeRebalanceFingerprint, TRANS_TYPE } = require('../services/production-lot/lotRebalanceCalculator');
const { lotBatchKey } = require('../services/production-lot/lotAllocationRules');
const { stockKey } = require('../services/delivery-order/deliveryOrderRules');
const { buildStockCodeResolver } = require('../services/product-code-mapping/stockFamilyKey');

const PRODUCTS = [{ id_product: 1, product_code: 'P1', product_name: 'Produk 1', is_active: 1 }];
const po = (id, created, over = {}) => ({
    po_detail_id: id, po_header_id: id, id_product: 1, base_qty: 100, fulfilled_qty: 0, detail_status: 'Active',
    po_number: `PO${id}`, created_at: created, header_status: 'Approved', product_code: 'P1', product_name: 'Produk 1', ...over
});
const LOTS = [
    { id: 1, lot_number: 'A', id_product: 1, actual_completed_datetime: '2026-02-01 10:00:00', expired_date: '2027-02-01' },
    { id: 2, lot_number: 'B', id_product: 1, actual_completed_datetime: '2026-02-02 10:00:00', expired_date: '2027-02-01' },
    { id: 3, lot_number: 'C', id_product: 1, actual_completed_datetime: '2026-02-03 10:00:00', expired_date: '2027-02-01' }
];
const BATCHES = [
    { id: 11, batch_number: 'B1', id_product: 1 }, { id: 12, batch_number: 'B2', id_product: 1 }, { id: 13, batch_number: 'B3', id_product: 1 }
];
const alloc = (id, poId, lotId, batchId, qty, status = 'Open') => ({ id, po_detail_id: poId, lot_id: lotId, id_batch: batchId, allocated_qty: qty, status });

// A -> PO1, B -> PO2, C -> PO3, lalu baris minus lot A (-40) terlambat di-upload: PO1 berlubang 40
const holeAllocations = () => [alloc(1, 1, 1, 11, 60), alloc(2, 2, 2, 12, 100, 'Closed'), alloc(3, 3, 3, 13, 100, 'Closed')];
const pos = (fulfilled) => [
    po(1, '2026-01-01 08:00:00', { fulfilled_qty: fulfilled[0] }),
    po(2, '2026-01-02 08:00:00', { fulfilled_qty: fulfilled[1] }),
    po(3, '2026-01-03 08:00:00', { fulfilled_qty: fulfilled[2] })
];
const base = (over = {}) => ({
    productId: 1, allocations: holeAllocations(), lots: LOTS, batches: BATCHES, openPoDetails: pos([60, 100, 100]),
    allProducts: PRODUCTS, productMappings: [], manualDeltas: new Map(),
    netByLotBatch: new Map([[lotBatchKey(1, 11), 60], [lotBatchKey(2, 12), 100], [lotBatchKey(3, 13), 100]]),
    netByLot: new Map([[1, 60], [2, 100], [3, 100]]),
    firstCompleted: new Map([[lotBatchKey(1, 11), '2026-02-01 10:00:00'], [lotBatchKey(2, 12), '2026-02-02 10:00:00'], [lotBatchKey(3, 13), '2026-02-03 10:00:00']]),
    lotDelivered: new Map(), ...over
});
const shape = (r) => r.changes.map((c) => [c.poNumber, c.lotNumber, c.currentQty, c.finalQty]);

test('lubang sebagian di PO terlama ditutup, alokasi sesudahnya dimundurkan sampai ujung', () => {
    const r = calculateRebalance(base());
    assert.deepEqual(r.blockers, []);
    assert.deepEqual(shape(r), [['PO1', 'B', 0, 40], ['PO2', 'B', 100, 60], ['PO2', 'C', 0, 40], ['PO3', 'C', 100, 60]]);
    assert.equal(r.canApply, true);
    assert.deepEqual(r.poSummary.map((p) => [p.poNumber, p.fulfilledBefore, p.fulfilledAfter, p.statusBefore, p.statusAfter]),
        [['PO1', 60, 100, 'Open', 'Closed'], ['PO3', 100, 60, 'Closed', 'Open']]);
    // total tiap lot tidak berubah
    const totalOf = (lot) => r.changes.filter((c) => c.lotNumber === lot).reduce((s, c) => s + c.finalQty - c.currentQty, 0);
    assert.deepEqual(['A', 'B', 'C'].map(totalOf), [0, 0, 0]);
});

test('susunan sudah ideal: tidak ada yang perlu digeser', () => {
    const r = calculateRebalance(base({
        allocations: [alloc(1, 1, 1, 11, 100, 'Closed'), alloc(2, 2, 2, 12, 100, 'Closed'), alloc(3, 3, 3, 13, 100, 'Closed')],
        openPoDetails: pos([100, 100, 100])
    }));
    assert.equal(r.noChange, true);
    assert.equal(r.canApply, false);
    assert.deepEqual(r.changes, []);
});

test('edit manual dibatalkan dengan record lawan (500 -> 400 dibatalkan 400 -> 500)', () => {
    const r = calculateRebalance(base({
        allocations: [alloc(1, 1, 1, 11, 100, 'Closed'), alloc(2, 2, 2, 12, 80), alloc(3, 3, 3, 13, 100, 'Closed')],
        openPoDetails: pos([100, 80, 100]),
        manualDeltas: new Map([[2, -20]])
    }));
    assert.deepEqual(r.blockers, []);
    assert.deepEqual(r.reversals.map((x) => [x.allocationId, x.manualDelta, x.from, x.to]), [[2, -20, 80, 100]]);
    assert.deepEqual(r.changes.map((c) => [c.poNumber, c.currentQty, c.qtyAfterReversal, c.finalQty, c.steps]),
        [['PO2', 80, 100, 100, [{ delta: 20, transType: TRANS_TYPE.REVERSAL }]]]);
});

test('pembatalan dan penggeseran pada alokasi yang sama menjadi dua langkah riwayat berurutan', () => {
    const r = calculateRebalance(base({
        // lubang di PO1 (A -40) dan edit manual B di PO2 (100 -> 70, delta -30 => dipulihkan ke 100)
        allocations: [alloc(1, 1, 1, 11, 60), alloc(2, 2, 2, 12, 70), alloc(3, 3, 3, 13, 100, 'Closed')],
        openPoDetails: pos([60, 70, 100]),
        manualDeltas: new Map([[2, -30]])
    }));
    assert.deepEqual(r.blockers, []);
    const b2 = r.changes.find((c) => c.poNumber === 'PO2' && c.lotNumber === 'B');
    assert.deepEqual(b2.steps.map((s) => [s.transType, s.delta]), [[TRANS_TYPE.REVERSAL, 30], [TRANS_TYPE.SHIFT, -40]]);
    assert.equal(b2.finalQty, 60);
});

test('pembatalan yang melebihi produksi bersih batch atau lot diblokir', () => {
    const r = calculateRebalance(base({
        allocations: [alloc(1, 1, 1, 11, 60), alloc(2, 2, 2, 12, 80), alloc(3, 3, 3, 13, 100, 'Closed')],
        openPoDetails: pos([60, 80, 100]),
        manualDeltas: new Map([[2, -20]]),
        netByLotBatch: new Map([[lotBatchKey(1, 11), 60], [lotBatchKey(2, 12), 90], [lotBatchKey(3, 13), 100]]),
        netByLot: new Map([[1, 60], [2, 90], [3, 100]])
    }));
    assert.equal(r.canApply, false);
    assert.ok(r.blockers.some((b) => /exceeds the produced quantity of lot B \/ batch B2/.test(b)));
    assert.ok(r.blockers.some((b) => /exceeds the produced quantity of lot B \(/.test(b)));
});

test('pembatalan yang membuat total lot di bawah qty terkirim diblokir', () => {
    const r = calculateRebalance(base({
        allocations: [alloc(1, 1, 1, 11, 60), alloc(2, 2, 2, 12, 100, 'Closed'), alloc(3, 3, 3, 13, 100, 'Closed')],
        manualDeltas: new Map([[2, 30]]),   // edit manual dulu menambah 30; pembatalan menguranginya jadi 70
        lotDelivered: new Map([[stockKey('P1', 'B'), 90]])
    }));
    assert.ok(r.blockers.some((b) => /below its delivered quantity \(70 allocated after reversal, 90 delivered\)/.test(b)));
});

test('pembatalan yang membuat qty negatif diblokir', () => {
    const r = calculateRebalance(base({ manualDeltas: new Map([[1, 90]]) }));
    assert.ok(r.blockers.some((b) => /would become negative/.test(b)));
});

test('alokasi Force Closed tidak disentuh dan tetap mengurangi kapasitas PO', () => {
    const r = calculateRebalance(base({
        allocations: [alloc(1, 1, 1, 11, 60), alloc(2, 2, 2, 12, 100, 'Closed'), alloc(3, 3, 3, 13, 100, 'Closed'), alloc(4, 1, 3, 13, 10, 'Force Closed')],
        openPoDetails: pos([70, 100, 100]),
        netByLotBatch: new Map([[lotBatchKey(1, 11), 60], [lotBatchKey(2, 12), 100], [lotBatchKey(3, 13), 110]])
    }));
    assert.deepEqual(r.blockers, []);
    assert.ok(!r.changes.some((c) => c.allocationId === 4));
    // PO1 sudah memegang 10 Force Closed: lubang yang bisa ditutup hanya 30
    const po1Added = r.changes.filter((c) => c.poNumber === 'PO1').reduce((s, c) => s + c.finalQty - c.currentQty, 0);
    assert.equal(po1Added, 30);
    const s1 = r.poSummary.find((p) => p.poNumber === 'PO1');
    assert.equal(s1.fulfilledAfter, 100);
});

test('lot yang tidak bisa ditempatkan penuh memblokir seluruh proses', () => {
    const r = calculateRebalance(base({
        // semua PO dibuat setelah tanggal selesai lot A: tidak ada tempat untuk lot A
        openPoDetails: [po(1, '2026-03-01 08:00:00', { fulfilled_qty: 60 }), po(2, '2026-03-02 08:00:00', { fulfilled_qty: 100 }), po(3, '2026-03-03 08:00:00', { fulfilled_qty: 100 })]
    }));
    assert.equal(r.canApply, false);
    assert.ok(r.blockers.some((b) => /Lot A \/ batch B1 \(60\) cannot be placed/.test(b)));
});

test('sidik jari: stabil untuk masukan sama, berubah bila hasil berubah', () => {
    const a = computeRebalanceFingerprint(calculateRebalance(base()));
    assert.equal(computeRebalanceFingerprint(calculateRebalance(base())), a);
    const b = computeRebalanceFingerprint(calculateRebalance(base({ allocations: [alloc(1, 1, 1, 11, 50), alloc(2, 2, 2, 12, 100, 'Closed'), alloc(3, 3, 3, 13, 100, 'Closed')], openPoDetails: pos([50, 100, 100]) })));
    assert.notEqual(a, b);
});

test('qty terkirim dipooling per keluarga produk: nomor lot sama berkode lama dan baru berbagi satu kuota', () => {
    const products = [
        { id_product: 1, product_code: 'P1', product_name: 'Lama', is_active: 1 },
        { id_product: 2, product_code: 'P2', product_name: 'Baru', is_active: 1 }
    ];
    const mappings = [{ id_product_old: 1, id_product_new: 2 }];
    const stockCodes = buildStockCodeResolver(products, mappings);
    const lots = [
        { id: 1, lot_number: 'A', id_product: 1, actual_completed_datetime: '2026-02-01 10:00:00' },
        { id: 4, lot_number: 'A', id_product: 2, actual_completed_datetime: '2026-02-01 10:00:00' }
    ];
    const common = {
        productId: 2, lots, batches: BATCHES, allProducts: products, productMappings: mappings, stockCodes,
        openPoDetails: [po(1, '2026-01-01 08:00:00', { fulfilled_qty: 50, id_product: 1, product_code: 'P1' }), po(2, '2026-01-02 08:00:00', { fulfilled_qty: 40, id_product: 2, product_code: 'P2' })],
        allocations: [alloc(1, 1, 1, 11, 50, 'Closed'), alloc(2, 2, 4, 12, 40)],
        manualDeltas: new Map([[2, -60]]), // edit manual menurunkan 100 menjadi 40; pembatalan memulihkan 100
        netByLotBatch: new Map([[lotBatchKey(1, 11), 50], [lotBatchKey(4, 12), 100]]), netByLot: new Map([[1, 50], [4, 100]]),
        firstCompleted: new Map([[lotBatchKey(1, 11), '2026-02-01 10:00:00'], [lotBatchKey(4, 12), '2026-02-01 10:00:00']])
    };
    // terkirim 140 untuk keluarga lot A: total gabungan setelah pembatalan 150 cukup
    const ok = calculateRebalance({ ...common, lotDelivered: new Map([[stockKey('P1', 'A'), 140]]) });
    assert.ok(!ok.blockers.some((b) => /delivered/.test(b)), ok.blockers.join(';'));
    // terkirim 160 melebihi total gabungan 150: diblokir (kuncinya kode kanonik P1, bukan P2)
    const blocked = calculateRebalance({ ...common, lotDelivered: new Map([[stockKey('P1', 'A'), 160]]) });
    assert.ok(blocked.blockers.some((b) => /below its delivered quantity \(150 allocated after reversal, 160 delivered\)/.test(b)));
});
