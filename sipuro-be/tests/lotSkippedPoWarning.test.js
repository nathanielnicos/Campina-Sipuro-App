'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLotFifoAllocation, computeAllocationFingerprint } = require('../services/production-lot/lotAllocationCalculator');

const PRODUCTS = [
    { product_code: 'P1', id_product: 1, product_name: 'Prod 1', is_active: 1 },
    { product_code: 'P2', id_product: 2, product_name: 'Prod 2', is_active: 1 }
];

// PO makin besar id-nya makin baru (created_at naik)
const po = (id, over = {}) => ({
    po_detail_id: id, po_header_id: id * 10, po_number: `PO${id}`, id_product: 1, product_code: 'P1',
    product_name: 'Prod 1', base_qty: 100, fulfilled_qty: 0, detail_status: 'Active',
    header_status: 'Approved', created_at: `2026-01-0${id} 08:00:00`, ...over
});

let n = 0;
const row = (over = {}) => {
    n += 1;
    return {
        batchNumber: 'B1', lotNumber: 'L1', itemCode: 'P1', lotStatus: 'GOOD', rawAllocationQty: 50,
        actualCompletedDatetime: '2026-02-01 10:00:00', expiredDate: '2027-02-01', rowHash: `sp${n}`,
        excelRowNumber: n, ...over
    };
};

const run = (rows, pos) => calculateLotFifoAllocation(rows, [], pos, PRODUCTS, {});

test('FIFO normal tanpa PO terlompati: tidak ada peringatan', () => {
    const r = run([row({ rawAllocationQty: 150 })], [po(1), po(2)]);
    assert.deepEqual(r.skippedPoWarnings, []);
    assert.equal(r.summary.skippedPoCount, 0);
});

test('PO lama masih punya sisa sementara PO lebih baru sudah terisi: PO lama diperingatkan', () => {
    const r = run([row({ rawAllocationQty: 30, excelRowNumber: 7 })], [
        po(1, { fulfilled_qty: 90 }),
        po(2, { fulfilled_qty: 50 })
    ]);
    // Alokasi tetap berjalan seperti biasa (PO lama 10, lalu PO baru 20)
    assert.deepEqual(r.detailedAllocations.map((a) => [a.poDetailId, a.addedQty]), [[1, 10], [2, 20]]);
    assert.equal(r.skippedPoWarnings.length, 1);
    assert.equal(r.summary.skippedPoCount, 1);
    const w = r.skippedPoWarnings[0];
    assert.equal(w.poNumber, 'PO1');
    assert.equal(w.poRemainingBefore, 10);
    assert.equal(w.addedQty, 10);
    assert.equal(w.newerPoNumber, 'PO2');
    assert.equal(w.newerPoFulfilledQty, 50);
    assert.equal(w.batchNumber, 'B1');
    assert.equal(w.lotNumber, 'L1');
    assert.equal(w.excelRowNumber, 7);
});

test('PO lebih baru yang diambil adalah yang terbaru di antara yang sudah terisi', () => {
    const r = run([row({ rawAllocationQty: 10 })], [
        po(1, { fulfilled_qty: 90 }),
        po(2, { fulfilled_qty: 40 }),
        po(3, { fulfilled_qty: 20 })
    ]);
    assert.equal(r.skippedPoWarnings.length, 1);
    assert.equal(r.skippedPoWarnings[0].newerPoNumber, 'PO3');
});

test('PO lebih baru kosong (belum terisi): tidak ada peringatan', () => {
    const r = run([row({ rawAllocationQty: 10 })], [po(1, { fulfilled_qty: 50 }), po(2, { fulfilled_qty: 0 })]);
    assert.deepEqual(r.skippedPoWarnings, []);
});

test('PO produk lain yang lebih baru dan terisi tidak dihitung', () => {
    const r = run([row({ rawAllocationQty: 10 })], [
        po(1, { fulfilled_qty: 50 }),
        po(2, { id_product: 2, product_code: 'P2', fulfilled_qty: 80 })
    ]);
    assert.deepEqual(r.skippedPoWarnings, []);
});

test('PO lebih baru yang sudah tidak aktif (Closed) tidak dihitung', () => {
    const r = run([row({ rawAllocationQty: 10 })], [
        po(1, { fulfilled_qty: 50 }),
        po(2, { fulfilled_qty: 100, detail_status: 'Closed' })
    ]);
    assert.deepEqual(r.skippedPoWarnings, []);
});

test('peringatan hanya informasi: tidak mengubah alokasi dan fingerprint', () => {
    const pos = () => [po(1, { fulfilled_qty: 90 }), po(2, { fulfilled_qty: 50 })];
    const withWarn = run([row({ rawAllocationQty: 30, rowHash: 'fixed1' })], pos());
    const stripped = { ...withWarn, skippedPoWarnings: [] };
    assert.equal(computeAllocationFingerprint(withWarn), computeAllocationFingerprint(stripped));
    assert.equal(withWarn.canSave, true);
});

test('grup yang tidak teralokasi tidak menghasilkan peringatan', () => {
    const r = run([row({ rawAllocationQty: 9999 })], [po(1, { fulfilled_qty: 90 }), po(2, { fulfilled_qty: 50 })]);
    assert.equal(r.previewResults.length, 0);
    assert.deepEqual(r.skippedPoWarnings, []);
});
