'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    calculateLotFifoAllocation, computeAllocationFingerprint, REASONS
} = require('../services/production-lot/lotAllocationCalculator');

const PRODUCTS = [
    { product_code: 'P1', id_product: 1, product_name: 'Prod 1' },
    { product_code: 'P2', id_product: 2, product_name: 'Prod 2' }
];

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
        actualCompletedDatetime: '2026-02-01 10:00:00', expiredDate: '2027-02-01', rowHash: `h${n}`,
        excelRowNumber: n, ...over
    };
};

const run = (rows, pos, ctx = {}, hashes = []) => calculateLotFifoAllocation(rows, hashes, pos, PRODUCTS, ctx);

test('satu PO menerima alokasi penuh dan status Open bila belum penuh', () => {
    const r = run([row()], [po(1)]);
    assert.equal(r.previewResults.length, 1);
    assert.equal(r.detailedAllocations[0].addedQty, 50);
    assert.equal(r.detailedAllocations[0].rowStatus, 'Open');
    assert.equal(r.canSave, true);
});

test('status Closed saat PO terpenuhi penuh', () => {
    const r = run([row({ rawAllocationQty: 100 })], [po(1)]);
    assert.equal(r.detailedAllocations[0].rowStatus, 'Closed');
});

test('FIFO memecah ke beberapa PO berdasarkan tanggal PO', () => {
    const r = run([row({ rawAllocationQty: 150 })], [po(2), po(1)]);
    const a = r.detailedAllocations;
    assert.deepEqual(a.map((x) => [x.poDetailId, x.addedQty]), [[1, 100], [2, 50]]);
});

test('kapasitas tidak cukup: seluruh grup Unallocated', () => {
    const r = run([row({ rawAllocationQty: 500 })], [po(1)]);
    assert.equal(r.previewResults.length, 0);
    assert.equal(r.unallocatedRows[0].reason, REASONS.EXCEEDS_CAPACITY);
    assert.equal(r.canSave, false);
});

test('Close Requested memblokir dengan BusinessError 409', () => {
    assert.throws(
        () => run([row()], [po(1, { detail_status: 'Close Requested' })]),
        (e) => e.status === 409 && /Close Requested/.test(e.message)
    );
});

test('PO Close Requested produk lain tidak memblokir', () => {
    const r = run([row()], [po(1), po(2, { product_code: 'P2', id_product: 2, detail_status: 'Close Requested' })]);
    assert.equal(r.previewResults.length, 1);
});

test('tanggal selesai lebih awal dari tanggal PO: tidak ada PO cocok', () => {
    const r = run([row({ actualCompletedDatetime: '2025-12-01 10:00:00' })], [po(1)]);
    assert.equal(r.unallocatedRows[0].reason, REASONS.NO_MATCHING_PO);
});

test('tanpa tanggal selesai: Missing production date', () => {
    const r = run([row({ actualCompletedDatetime: null })], [po(1)]);
    assert.equal(r.unallocatedRows[0].reason, REASONS.MISSING_DATE);
});

test('nomor batch kosong: Missing batch number, bukan konflik batch', () => {
    const r = run([row({ batchNumber: '' }), row({ batchNumber: '', itemCode: 'P2' })], [po(1)]);
    assert.deepEqual(r.unallocatedRows.map((x) => x.reason), [REASONS.MISSING_BATCH, REASONS.MISSING_BATCH]);
});

test('nomor lot kosong: Missing lot number', () => {
    const r = run([row({ lotNumber: '' })], [po(1)]);
    assert.equal(r.unallocatedRows[0].reason, REASONS.MISSING_LOT);
});

test('batch dan lot kosong sekaligus: alasan batch didahulukan', () => {
    const r = run([row({ batchNumber: '', lotNumber: '' })], [po(1)]);
    assert.equal(r.unallocatedRows[0].reason, REASONS.MISSING_BATCH);
});

test('batch yang sama untuk dua produk di file: konflik', () => {
    const r = run([row(), row({ itemCode: 'P2' })], [po(1), po(2, { product_code: 'P2', id_product: 2 })]);
    assert.ok(r.unallocatedRows.every((x) => x.reason === REASONS.BATCH_CONFLICT));
});

test('batch di database milik produk lain: konflik', () => {
    const r = run([row()], [po(1)], { existingBatches: [{ batch_number: 'B1', id_product: 2 }] });
    assert.equal(r.unallocatedRows[0].reason, REASONS.BATCH_CONFLICT);
});

test('net nol: Unallocated', () => {
    const r = run([row({ rawAllocationQty: 10 }), row({ rawAllocationQty: -10 })], [po(1)]);
    assert.equal(r.unallocatedRows.length, 2);
    assert.equal(r.unallocatedRows[0].reason, REASONS.NET_ZERO);
});

test('net negatif mengurangi PO terbaru lebih dulu', () => {
    const ctx = {
        existingLots: [{ id: 7, lot_number: 'L1', id_product: 1 }],
        existingBatches: [{ id: 9, batch_number: 'B1', id_product: 1 }],
        existingAllocations: [
            { po_detail_id: 1, lot_id: 7, id_batch: 9, allocated_qty: 60, status: 'Open' },
            { po_detail_id: 2, lot_id: 7, id_batch: 9, allocated_qty: 30, status: 'Open' }
        ]
    };
    const r = run([row({ rawAllocationQty: -40 })], [po(1, { fulfilled_qty: 60 }), po(2, { fulfilled_qty: 30 })], ctx);
    assert.deepEqual(r.detailedAllocations.map((x) => [x.poDetailId, x.addedQty]), [[2, -30], [1, -10]]);
});

test('retur tanpa alokasi lama dan retur melebihi alokasi', () => {
    const none = run([row({ rawAllocationQty: -5 })], [po(1)]);
    assert.equal(none.unallocatedRows[0].reason, REASONS.NO_EXISTING_ALLOCATION);

    const ctx = {
        existingLots: [{ id: 7, lot_number: 'L1', id_product: 1 }],
        existingBatches: [{ id: 9, batch_number: 'B1', id_product: 1 }],
        existingAllocations: [{ po_detail_id: 1, lot_id: 7, id_batch: 9, allocated_qty: 20, status: 'Open' }]
    };
    const over = run([row({ rawAllocationQty: -50 })], [po(1, { fulfilled_qty: 20 })], ctx);
    assert.equal(over.unallocatedRows[0].reason, REASONS.REDUCTION_EXCEEDS);
});

test('kategori: tidak terdaftar, duplikat, bukan GOOD', () => {
    const r = run(
        [row({ itemCode: 'XX' }), row({ rowHash: 'dup' }), row({ lotStatus: 'HOLD' }), row({ rowHash: 'dup2', lotStatus: 'HOLD' })],
        [po(1)], {}, ['dup', 'dup2']
    );
    assert.equal(r.unregisteredRows.length, 1);
    assert.equal(r.duplicateRows.length, 1);
    assert.equal(r.nonGoodRows.length, 1);
    assert.equal(r.duplicateStatusUpdateRows.length, 1);
});

// Lot L1 sudah teralokasi di batch B1 (PO1) dan B2 (PO1); data tersimpan untuk dua batch
const twoBatchCtx = () => ({
    existingLots: [{ id: 7, lot_number: 'L1', id_product: 1 }],
    existingBatches: [{ id: 9, batch_number: 'B1', id_product: 1 }, { id: 10, batch_number: 'B2', id_product: 1 }],
    existingAllocations: [
        { po_detail_id: 1, lot_id: 7, id_batch: 9, allocated_qty: 30, status: 'Open' },
        { po_detail_id: 1, lot_id: 7, id_batch: 10, allocated_qty: 40, status: 'Open' }
    ]
});

test('retur batch B1 hanya mengurangi alokasi (lot, batch) yang sama, bukan batch lain', () => {
    const r = run([row({ batchNumber: 'B1', rawAllocationQty: -20 })], [po(1, { fulfilled_qty: 70 })], twoBatchCtx());
    assert.deepEqual(r.detailedAllocations.map((x) => [x.batchNumber, x.addedQty]), [['B1', -20]]);
    assert.equal(r.detailedAllocations[0].fulfilledQty, 50);
});

test('retur batch B2 (id berbeda) hanya mengurangi alokasi B2', () => {
    const r = run([row({ batchNumber: 'B2', rawAllocationQty: -25 })], [po(1, { fulfilled_qty: 70 })], twoBatchCtx());
    assert.deepEqual(r.detailedAllocations.map((x) => [x.batchNumber, x.addedQty]), [['B2', -25]]);
    // 35 melebihi alokasi B1 (30) tetapi masih di bawah alokasi B2 (40): harus lolos untuk B2
    const fits = run([row({ batchNumber: 'B2', rawAllocationQty: -35 })], [po(1, { fulfilled_qty: 70 })], twoBatchCtx());
    assert.deepEqual(fits.detailedAllocations.map((x) => [x.batchNumber, x.addedQty]), [['B2', -35]]);
    const tooMuch = run([row({ batchNumber: 'B2', rawAllocationQty: -45 })], [po(1, { fulfilled_qty: 70 })], twoBatchCtx());
    assert.equal(tooMuch.unallocatedRows[0].reason, REASONS.REDUCTION_EXCEEDS);
});

test('retur lebih besar dari alokasi batch itu ditolak walau lot yang sama punya alokasi di batch lain', () => {
    const r = run([row({ batchNumber: 'B1', rawAllocationQty: -35 })], [po(1, { fulfilled_qty: 70 })], twoBatchCtx());
    assert.equal(r.unallocatedRows[0].reason, REASONS.REDUCTION_EXCEEDS);
});

test('retur untuk batch baru (belum tersimpan) pada lot yang sudah punya alokasi di batch lain: tidak ada alokasi', () => {
    const r = run([row({ batchNumber: 'B3', rawAllocationQty: -5 })], [po(1, { fulfilled_qty: 70 })], twoBatchCtx());
    assert.equal(r.unallocatedRows[0].reason, REASONS.NO_EXISTING_ALLOCATION);
});

test('lot yang sama di batch baru: alokasi batch lain tidak menghalangi dan tidak ikut berubah', () => {
    const ctx = twoBatchCtx();
    const r = run([row({ batchNumber: 'B3', rawAllocationQty: 20 })], [po(1, { fulfilled_qty: 70 })], ctx);
    assert.deepEqual(r.detailedAllocations.map((x) => [x.batchNumber, x.addedQty]), [['B3', 20]]);
    assert.equal(ctx.existingAllocations[0].allocated_qty, 30);
});

test('plus pada batch yang sudah punya alokasi Force Closed di PO itu: PO itu dilewati, batch lain tidak', () => {
    const ctx = twoBatchCtx();
    ctx.existingAllocations[0].status = 'Force Closed';
    const r = run([row({ batchNumber: 'B1', rawAllocationQty: 10 })], [po(1, { fulfilled_qty: 70 }), po(2)], ctx);
    assert.deepEqual(r.detailedAllocations.map((x) => x.poDetailId), [2]);
    const r2 = run([row({ batchNumber: 'B2', rawAllocationQty: 10 })], [po(1, { fulfilled_qty: 70 })], twoBatchCtx());
    assert.deepEqual(r2.detailedAllocations.map((x) => x.poDetailId), [1]);
});

test('PO Force Closed / header tidak eligible tidak menerima alokasi', () => {
    const r = run([row()], [po(1, { header_status: 'Draft' })]);
    assert.equal(r.unallocatedRows[0].reason, REASONS.NO_MATCHING_PO);
});

test('alokasi lama Force Closed pada PO itu dilewati', () => {
    const ctx = {
        existingLots: [{ id: 7, lot_number: 'L1', id_product: 1 }],
        existingBatches: [{ id: 9, batch_number: 'B1', id_product: 1 }],
        existingAllocations: [{ po_detail_id: 1, lot_id: 7, id_batch: 9, allocated_qty: 10, status: 'Force Closed' }]
    };
    const r = run([row()], [po(1, { fulfilled_qty: 10 }), po(2)], ctx);
    assert.deepEqual(r.detailedAllocations.map((x) => x.poDetailId), [2]);
});

test('urutan grup: tanggal selesai terlama dahulu', () => {
    const r = run([
        row({ batchNumber: 'B2', lotNumber: 'L2', actualCompletedDatetime: '2026-03-01 10:00:00', rawAllocationQty: 60 }),
        row({ batchNumber: 'B1', lotNumber: 'L1', actualCompletedDatetime: '2026-02-01 10:00:00', rawAllocationQty: 60 })
    ], [po(1)]);
    assert.equal(r.previewResults[0].batchNumber, 'B1');
    assert.equal(r.previewResults[0].allocations[0].addedQty, 60);
    // Grup B2 diproses kedua: sisa kapasitas PO hanya 40, sehingga seluruh grup Unallocated
    assert.equal(r.previewResults.length, 1);
    assert.equal(r.unallocatedRows[0].batchNumber, 'B2');
    assert.equal(r.unallocatedRows[0].reason, REASONS.EXCEEDS_CAPACITY);
});

test('fingerprint stabil dan berubah saat hasil berubah', () => {
    const rows = () => [row({ rowHash: 'fp1' })];
    const a = computeAllocationFingerprint(run(rows(), [po(1)]));
    const b = computeAllocationFingerprint(run(rows(), [po(1)]));
    const c = computeAllocationFingerprint(run(rows(), [po(1, { fulfilled_qty: 10 })]));
    assert.equal(a, b);
    assert.notEqual(a, c);
});
