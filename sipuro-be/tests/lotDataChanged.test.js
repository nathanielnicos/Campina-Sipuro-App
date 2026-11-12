'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLotFifoAllocation } = require('../services/production-lot/lotAllocationCalculator');
const { MATCH_BY } = require('../services/production-lot/lotAllocationRules');

const PRODUCTS = [{ product_code: 'P1', id_product: 1, product_name: 'Prod 1', is_active: 1 }];

const po = (id, over = {}) => ({
    po_detail_id: id, po_header_id: id * 10, po_number: `PO${id}`, id_product: 1, product_code: 'P1',
    product_name: 'Prod 1', base_qty: 1000, fulfilled_qty: 0, detail_status: 'Active',
    header_status: 'Approved', created_at: `2026-01-0${id} 08:00:00`, ...over
});

let n = 0;
const row = (over = {}) => {
    n += 1;
    return {
        batchNumber: 'B1', lotNumber: 'L1', itemCode: 'P1', lotStatus: 'GOOD', transType: 'WIP Completion',
        qtyPac: 50, rawAllocationQty: 50, actualCompletedDatetime: '2026-11-04 14:05:31', expiredDate: '2027-11-04',
        rowHash: `h${n}`, excelRowNumber: n, ...over
    };
};

// Baris upload yang sudah tersimpan di database (bentuk hasil loader)
const stored = (over = {}) => ({
    batch_number: 'B1', lot_number: 'L1', item_code: 'P1', trans_type: 'WIP Completion', qty_pac: 50,
    completed: '2026-11-04 14:05:31', expired: '2028-11-03', doc_source: null, ...over
});

const run = (rows, existingDetailRows = [], hashes = [], pos = [po(1)]) =>
    calculateLotFifoAllocation(rows, hashes, pos, PRODUCTS, { existingDetailRows });

test('kedaluwarsa berbeda: tetap baris baru (disimpan) dan masuk dataChangedRows dengan alasan', () => {
    const r = run([row()], [stored()]);
    assert.equal(r.newRows.length, 1);
    assert.equal(r.dataChangedRows.length, 1);
    assert.equal(r.summary.dataChangedCount, 1);
    assert.equal(r.summary.expiryChangedCount, 1);
    assert.equal(r.dataChangedRows[0].dataChange.type, 'EXPIRY');
    assert.equal(r.dataChangedRows[0].dataChange.reason, 'Exp Date differs from saved row: 2028-11-03 → 2027-11-04');
    assert.equal(r.dataChangedRows[0].dataChange.result, 'Saved as new row');
    assert.equal(r.canSave, true);
});

test('alur simpan tidak berubah: alokasi dan baris baru sama dengan tanpa baris tersimpan', () => {
    const rows = () => [row({ rowHash: 'x1' })];
    const withStored = run(rows(), [stored()]);
    const without = run(rows(), []);
    assert.deepEqual(withStored.detailedAllocations, without.detailedAllocations);
    assert.deepEqual(withStored.previewResults, without.previewResults);
    assert.equal(withStored.newRows.length, without.newRows.length);
});

test('kedaluwarsa sama: tidak ditandai', () => {
    const r = run([row()], [stored({ expired: '2027-11-04' })]);
    assert.equal(r.dataChangedRows.length, 0);
    assert.equal(r.summary.dataChangedCount, 0);
});

test('qty, tanggal-jam, lot atau jenis berbeda: bukan baris yang sama, tidak ditandai', () => {
    [
        { qty_pac: 51 },
        { completed: '2026-11-04 14:05:32' },
        { lot_number: 'L2' },
        { trans_type: 'WIP Completion Return' },
        { item_code: 'P9' }
    ].forEach((over) => {
        const r = run([row()], [stored(over)]);
        assert.equal(r.dataChangedRows.length, 0, JSON.stringify(over));
    });
});

test('jenis berbasis batch dicocokkan dengan nomor batch: batch berbeda tidak ditandai', () => {
    const r = run([row()], [stored({ batch_number: 'B2' })]);
    assert.equal(r.dataChangedRows.length, 0);
});

test('jenis berbasis lot dicocokkan dengan Doc Source, bukan batch', () => {
    const lotRow = (over = {}) => row({
        matchBy: MATCH_BY.LOT, batchNumber: '', docSource: 'DOC1', transType: 'Physical Inv Adjust (+)',
        qtyPac: 20, rawAllocationQty: 20, ...over
    });
    const storedLot = (over = {}) => stored({ batch_number: 'B7', doc_source: 'DOC1', trans_type: 'Physical Inv Adjust (+)', qty_pac: 20, ...over });
    // PO dan batch untuk tambahan output lot: batch dicari dari lotBatches; tanpa itu baris menjadi Unallocated
    const ctx = (existingDetailRows) => ({ existingDetailRows, lotBatches: [], existingLots: [], existingAllocations: [] });
    const same = calculateLotFifoAllocation([lotRow()], [], [po(1)], PRODUCTS, ctx([storedLot()]));
    assert.equal(same.dataChangedRows.length, 1, 'Doc Source sama, kedaluwarsa beda');
    const otherDoc = calculateLotFifoAllocation([lotRow()], [], [po(1)], PRODUCTS, ctx([storedLot({ doc_source: 'DOC2' })]));
    assert.equal(otherDoc.dataChangedRows.length, 0, 'Doc Source beda = dokumen lain');
});

test('baris tanpa kedaluwarsa di file tetapi tersimpan dengan kedaluwarsa: ditandai dengan tanda strip', () => {
    const r = run([row({ expiredDate: null })], [stored()]);
    assert.equal(r.dataChangedRows.length, 1);
    assert.equal(r.dataChangedRows[0].dataChange.reason, 'Exp Date differs from saved row: 2028-11-03 → -');
});

test('hash sama (Duplicate) tidak ikut dihitung sebagai kedaluwarsa berbeda', () => {
    const r = run([row({ rowHash: 'dup' })], [stored()], ['dup']);
    assert.equal(r.duplicateRows.length, 1);
    assert.equal(r.dataChangedRows.length, 0);
});

test('status berubah dari GOOD: masuk dataChangedRows, tidak disimpan, dengan alasan', () => {
    const r = run([row({ rowHash: 'dup', lotStatus: 'HOLD' })], [], ['dup']);
    assert.equal(r.duplicateStatusUpdateRows.length, 1);
    assert.equal(r.dataChangedRows.length, 1);
    assert.equal(r.dataChangedRows[0].dataChange.type, 'STATUS');
    assert.equal(r.dataChangedRows[0].dataChange.reason, 'Lot status changed: GOOD → HOLD');
    assert.equal(r.dataChangedRows[0].dataChange.result, 'Not saved');
    assert.equal(r.newRows.length, 0);
});

test('status berubah dan kedaluwarsa berbeda digabung, urut nomor baris Excel', () => {
    const rows = [
        row({ excelRowNumber: 9, rowHash: 'a1' }),
        row({ excelRowNumber: 3, rowHash: 'dup', lotStatus: 'QC', lotNumber: 'L9' })
    ];
    const r = run(rows, [stored()], ['dup']);
    assert.deepEqual(r.dataChangedRows.map((x) => [x.excelRowNumber, x.dataChange.type]), [[3, 'STATUS'], [9, 'EXPIRY']]);
    assert.equal(r.summary.dataChangedCount, 2);
});

test('baris kedaluwarsa berbeda yang tidak teralokasi dilaporkan Not saved', () => {
    const r = run([row({ rawAllocationQty: 5000, qtyPac: 5000 })], [stored({ qty_pac: 5000 })]);
    assert.equal(r.newRows.length, 0);
    assert.equal(r.dataChangedRows.length, 1);
    assert.equal(r.dataChangedRows[0].dataChange.result, 'Not saved (unallocated)');
});

test('baris kembar dalam file yang sama tanpa baris tersimpan tidak ditandai', () => {
    const r = run([row({ rowHash: 'same' }), row({ rowHash: 'same2' })], []);
    assert.equal(r.dataChangedRows.length, 0);
});

test('tanpa existingDetailRows di konteks (pemanggil lain) perilaku tidak berubah', () => {
    const r = calculateLotFifoAllocation([row()], [], [po(1)], PRODUCTS, {});
    assert.equal(r.dataChangedRows.length, 0);
    assert.equal(r.newRows.length, 1);
});
