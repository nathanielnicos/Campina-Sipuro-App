'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

let sheet = [];
const statusCalls = [];
const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request === 'xlsx') {
        return {
            read: () => ({ SheetNames: ['S'], Sheets: { S: { '!ref': 'A1:T20', K1: { w: '2026-02-01 10:00:00' } } } }),
            utils: { sheet_to_json: () => sheet, decode_range: () => ({ s: { r: 0 } }) }
        };
    }
    if (request.endsWith('/config/db')) return { sipuroDb: null };
    if (request.endsWith('/helpers/poLogHelper')) return { logPOHeader: async () => {} };
    if (request === './lotStatusService') {
        return {
            refreshPOStatus: async (_c, id) => statusCalls.push(['po', id]),
            refreshBatchStatuses: async (_c, ids) => statusCalls.push(['batches', [...ids].sort((a, b) => a - b)]),
            recalculateFulfilledQty: async (_c, ids) => statusCalls.push(['recalc', ids]),
            syncAllocationStatuses: async () => [],
            syncBatchCompletedDates: async () => {}
        };
    }
    return originalLoad.apply(this, arguments);
};

const rules = require('../services/production-lot/lotAllocationRules');
const { parseProductionExcel } = require('../services/production-lot/lotUploadParser');
const { calculateLotFifoAllocation, computeAllocationFingerprint, REASONS } = require('../services/production-lot/lotAllocationCalculator');
const { commitProductionAllocationTransaction } = require(path.join('..', 'services/production-lot/lotCommitService'));
const { stockKey } = require('../services/delivery-order/deliveryOrderRules');
const { findLotRule } = require('./fixtures/transTypeRules');

test('kunci grup lot-item membedakan lot dan item', () => {
    assert.notEqual(rules.lotItemKey('L1', 'P1'), rules.lotItemKey('L1', 'P2'));
    assert.notEqual(rules.lotItemKey('L1', 'P1'), rules.lotItemKey('L2', 'P1'));
});

// ---------- parser ----------

const header = () => { const h = Array.from({ length: 6 }, () => []); h[0][10] = '2026-02-01 10:00:00'; return h; };
const excelRow = (type, { qtyCol, qty, batch = 'BATCH B1', lot = 'L1', item = 'P1', date = '2026-02-01 10:00:00' }) => {
    const r = [];
    r[1] = type; r[2] = 'GOOD'; r[3] = date; r[4] = item; r[6] = batch; r[11] = lot; r[15] = '2027-02-01';
    r[qtyCol] = qty;
    return r;
};

test('parser: jenis berbasis lot memakai kolom T, mengabaikan kolom G, dan bertanda negatif', () => {
    sheet = [...header(),
        excelRow('Good Issue Sample QC', { qtyCol: 19, qty: 264, batch: '499600' }),
        excelRow('good issue sample rnd', { qtyCol: 19, qty: 16, batch: '505874' }),
        excelRow('WIP  Issue', { qtyCol: 19, qty: 5508, batch: 'BATCHW1R2600027' })
    ];
    const { rawRows } = parseProductionExcel(Buffer.from('x'), findLotRule);
    assert.equal(rawRows.length, 3);
    assert.deepEqual(rawRows.map((r) => r.transType), ['Good Issue Sample QC', 'Good Issue Sample RND', 'WIP Issue']);
    assert.deepEqual(rawRows.map((r) => r.batchNumber), ['', '', '']);
    // Doc Source disimpan sebagai referensi, awalan BATCH dibuang
    assert.deepEqual(rawRows.map((r) => r.docSource), ['499600', '505874', 'W1R2600027']);
    assert.deepEqual(rawRows.map((r) => r.matchBy), ['LOT', 'LOT', 'LOT']);
    assert.deepEqual(rawRows.map((r) => r.qtyPac), [264, 16, 5508]);
    assert.deepEqual(rawRows.map((r) => r.rawAllocationQty), [-264, -16, -5508]);
    assert.equal(new Set(rawRows.map((r) => r.rowHash)).size, 3);
});

test('parser: Completion dan Return tetap berbasis batch dengan kolom lamanya; jenis tak dikenal dilewati', () => {
    sheet = [...header(),
        excelRow('WIP Completion', { qtyCol: 16, qty: 10 }),
        excelRow('WIP Completion Return', { qtyCol: 19, qty: 4 }),
        excelRow('Sales order issue', { qtyCol: 19, qty: 9 })
    ];
    const { rawRows } = parseProductionExcel(Buffer.from('x'), findLotRule);
    assert.equal(rawRows.length, 2);
    assert.deepEqual(rawRows.map((r) => [r.transType, r.batchNumber, r.matchBy, r.rawAllocationQty]),
        [['WIP Completion', 'B1', 'BATCH_LOT', 10], ['WIP Completion Return', 'B1', 'BATCH_LOT', -4]]);
});

test('parser: hash baris lot-only tidak bergantung pada isi kolom G', () => {
    const a = (batch) => { sheet = [...header(), excelRow('WIP Issue', { qtyCol: 19, qty: 5, batch })]; return parseProductionExcel(Buffer.from('x'), findLotRule).rawRows[0].rowHash; };
    assert.equal(a('111'), a('BATCH999'));
});

// ---------- kalkulator ----------

const PRODUCTS = [{ product_code: 'P1', id_product: 1, product_name: 'Prod 1', is_active: 1 }];
const po = (id, over = {}) => ({
    po_detail_id: id, po_header_id: id * 10, po_number: `PO${id}`, id_product: 1, product_code: 'P1',
    product_name: 'Prod 1', base_qty: 100, fulfilled_qty: 0, detail_status: 'Active',
    header_status: 'Approved', created_at: `2026-01-0${id} 08:00:00`, ...over
});
let n = 0;
const issueRow = (qty, over = {}) => {
    n += 1;
    return {
        batchNumber: '', lotNumber: 'L1', itemCode: 'P1', lotStatus: 'GOOD', transType: 'Good Issue Sample QC', matchBy: 'LOT',
        qtyPac: qty, rawAllocationQty: -qty, actualCompletedDatetime: '2026-03-01 10:00:00', expiredDate: '2027-02-01',
        rowHash: `i${n}`, excelRowNumber: n, qtyIsWhole: true, ...over
    };
};
const batchRow = (qty, over = {}) => {
    n += 1;
    return {
        batchNumber: 'B1', lotNumber: 'L1', itemCode: 'P1', lotStatus: 'GOOD', transType: 'WIP Completion', matchBy: 'BATCH_LOT',
        qtyPac: Math.abs(qty), rawAllocationQty: qty, actualCompletedDatetime: '2026-02-01 10:00:00', expiredDate: '2027-02-01',
        rowHash: `b${n}`, excelRowNumber: n, qtyIsWhole: true, ...over
    };
};
// Lot L1 (id 5) punya dua batch: B1 (id 11), B2 (id 12). PO1 lebih lama dari PO2.
const alloc = (id, poDetailId, batchId, qty) => ({ id, po_detail_id: poDetailId, lot_id: 5, id_batch: batchId, allocated_qty: qty, status: 'Open' });
const baseContext = (over = {}) => ({
    existingBatches: [],
    allocationBatches: [{ id: 11, batch_number: 'B1' }, { id: 12, batch_number: 'B2' }],
    existingLots: [{ id: 5, lot_number: 'L1', id_product: 1 }],
    existingAllocations: [alloc(1, 1, 11, 30), alloc(2, 2, 11, 20), alloc(3, 2, 12, 40)],
    ...over
});
const POS = () => [po(1, { fulfilled_qty: 30 }), po(2, { fulfilled_qty: 60 })];
const run = (rows, pos, ctx) => calculateLotFifoAllocation(rows, [], pos, PRODUCTS, ctx);
const shape = (r) => r.detailedAllocations.map((a) => [a.poDetailId, a.batchNumber, a.batchId, a.addedQty]);

test('issue lot-only mengurangi lintas batch: PO terbaru dahulu, lalu batch terbaru', () => {
    const r = run([issueRow(60)], POS(), baseContext());
    assert.equal(r.canSave, true);
    assert.deepEqual(shape(r), [[2, 'B2', 12, -40], [2, 'B1', 11, -20]]);
    // PO1 tidak tersentuh; fulfilled PO2 turun dari 60 ke 0
    const po2 = r.previewResults[0].allocations.filter((a) => a.poDetailId === 2);
    assert.deepEqual(po2.map((a) => [a.previousFulfilledQty, a.newFulfilledQty]), [[60, 20], [20, 0]]);
    assert.equal(r.previewResults[0].lotOnly, true);
    assert.equal(r.previewResults[0].batchNumber, '');
    assert.equal(r.previewResults[0].totalQtyOutput, -60);
});

test('issue melewati PO terbaru berlanjut ke PO yang lebih lama', () => {
    const r = run([issueRow(80)], POS(), baseContext());
    assert.deepEqual(shape(r), [[2, 'B2', 12, -40], [2, 'B1', 11, -20], [1, 'B1', 11, -20]]);
});

test('beberapa jenis issue untuk lot dan item yang sama digabung menjadi satu grup', () => {
    const r = run([
        issueRow(10, { transType: 'Good Issue Sample QC' }),
        issueRow(5, { transType: 'WIP Issue' })
    ], POS(), baseContext());
    assert.equal(r.previewResults.length, 1);
    assert.equal(r.previewResults[0].rowCount, 2);
    assert.equal(r.previewResults[0].totalQtyOutput, -15);
    assert.equal(r.categorizedDetails.newRows.length, 2);
});

test('issue melebihi total alokasi lot: semua baris grup Unallocated, tidak ada yang dikurangi', () => {
    const r = run([issueRow(91)], POS(), baseContext());
    assert.equal(r.canSave, false);
    assert.equal(r.unallocatedRows[0].reason, REASONS.REDUCTION_EXCEEDS);
    assert.equal(r.detailedAllocations.length, 0);
});

test('lot belum punya alokasi: No existing allocation to reduce', () => {
    const r = run([issueRow(5, { lotNumber: 'L9' })], POS(), baseContext());
    assert.equal(r.unallocatedRows[0].reason, REASONS.NO_EXISTING_ALLOCATION);
    const noLot = run([issueRow(5)], POS(), { existingBatches: [], existingLots: [], existingAllocations: [] });
    assert.equal(noLot.unallocatedRows[0].reason, REASONS.NO_EXISTING_ALLOCATION);
});

test('tanpa tanggal: Missing production date; lot kosong: Missing lot number; batch kosong tidak jadi masalah', () => {
    assert.equal(run([issueRow(5, { actualCompletedDatetime: null })], POS(), baseContext()).unallocatedRows[0].reason, REASONS.MISSING_DATE);
    assert.equal(run([issueRow(5, { lotNumber: '' })], POS(), baseContext()).unallocatedRows[0].reason, REASONS.MISSING_LOT);
    assert.equal(run([issueRow(5)], POS(), baseContext()).unallocatedRows.length, 0);
});

test('issue tidak boleh menurunkan alokasi di bawah qty terkirim (aturan D4)', () => {
    const ctx = (delivered) => baseContext({
        lotAllocated: new Map([[stockKey('P1', 'L1'), 90]]),
        lotDelivered: new Map([[stockKey('P1', 'L1'), delivered]])
    });
    const blocked = run([issueRow(20)], POS(), ctx(80)); // ruang 10
    assert.equal(blocked.unallocatedRows[0].reason, REASONS.BELOW_DELIVERED);
    assert.equal(run([issueRow(10)], POS(), ctx(80)).canSave, true);
});

test('alokasi Force Closed/Canceled tidak dikurangi issue', () => {
    const r = run([issueRow(10)], POS(), baseContext({
        existingAllocations: [{ ...alloc(1, 1, 11, 30), status: 'Force Closed' }, alloc(2, 2, 12, 40)]
    }));
    assert.deepEqual(shape(r), [[2, 'B2', 12, -10]]);
    const onlyClosed = run([issueRow(10)], POS(), baseContext({ existingAllocations: [{ ...alloc(1, 1, 11, 30), status: 'Canceled' }] }));
    assert.equal(onlyClosed.unallocatedRows[0].reason, REASONS.NO_EXISTING_ALLOCATION);
});

test('issue dan completion lot baru dalam file yang sama: issue mengurangi alokasi yang baru dibuat', () => {
    const r = run([
        batchRow(50, { lotNumber: 'L9', batchNumber: 'B9' }),
        issueRow(20, { lotNumber: 'L9', actualCompletedDatetime: '2026-02-05 10:00:00' })
    ], [po(1)], { existingBatches: [], existingLots: [], existingAllocations: [] });
    assert.equal(r.canSave, true);
    assert.deepEqual(shape(r), [[1, 'B9', null, 50], [1, 'B9', null, -20]]);
    const items = r.previewResults.flatMap((g) => g.allocations);
    assert.deepEqual(items.map((a) => [a.previousFulfilledQty, a.newFulfilledQty]), [[0, 50], [50, 30]]);
});

test('waktu sama: grup batch diproses dahulu, lalu issue', () => {
    const t = '2026-02-01 10:00:00';
    const r = run([
        issueRow(10, { lotNumber: 'L9', actualCompletedDatetime: t }),
        batchRow(50, { lotNumber: 'L9', batchNumber: 'B9', actualCompletedDatetime: t })
    ], [po(1)], { existingBatches: [], existingLots: [], existingAllocations: [] });
    assert.deepEqual(shape(r), [[1, 'B9', null, 50], [1, 'B9', null, -10]]);
});

test('batch baru dari file ini dianggap terbaru dibanding batch lama di database', () => {
    const r = run([
        batchRow(30, { batchNumber: 'B9', actualCompletedDatetime: '2026-02-01 10:00:00' }),
        issueRow(35)
    ], [po(1, { fulfilled_qty: 30 }), po(2, { fulfilled_qty: 60 })], baseContext());
    // PO terbaru (PO2) dahulu: B2 (40) lalu B1 (20) bukan B9; PO2 tidak menerima batch baru karena FIFO memilih PO1
    assert.equal(r.canSave, true);
    const issueAllocs = r.detailedAllocations.filter((a) => a.addedQty < 0);
    assert.deepEqual(issueAllocs.map((a) => [a.poDetailId, a.batchNumber, a.addedQty]), [[2, 'B2', -35]]);
});

test('retur berbasis batch tidak berubah: hanya pasangan (lot, batch) yang sama', () => {
    const r = run([batchRow(-25, { batchNumber: 'B1', transType: 'WIP Completion Return' })], POS(), baseContext({ existingBatches: [{ id: 11, batch_number: 'B1', id_product: 1 }] }));
    assert.deepEqual(shape(r), [[2, 'B1', 11, -20], [1, 'B1', 11, -5]]);
});

test('sidik jari hasil memuat batch yang dikurangi pada grup lot-only', () => {
    const row = issueRow(10);
    const a = computeAllocationFingerprint(run([row], POS(), baseContext()));
    const b = computeAllocationFingerprint(run([row], POS(), baseContext({
        existingAllocations: [alloc(1, 1, 11, 30), alloc(2, 2, 11, 40)],
        allocationBatches: [{ id: 11, batch_number: 'B1' }, { id: 12, batch_number: 'B2' }]
    })));
    assert.notEqual(a, b);
    assert.equal(computeAllocationFingerprint(run([row], POS(), baseContext())), a);
});

// ---------- commit ----------

const makeConn = (state = {}) => {
    const calls = [];
    return {
        calls,
        query: async (sql, params) => {
            calls.push({ sql, params });
            const s = sql.replace(/\s+/g, ' ').trim();
            if (/^INSERT INTO production_lot_upload_logs/.test(s)) return [{ insertId: 77 }];
            if (/^SELECT id, lot_number, id_product FROM lots/.test(s)) return [[{ id: 5, lot_number: 'L1', id_product: 1 }]];
            if (/^SELECT id, batch_number, id_product FROM batches/.test(s)) return [state.existingBatches || []];
            if (/^SELECT id, batch_number FROM batches/.test(s)) return [state.createdBatches || []];
            if (/FROM po_lot_allocations WHERE lot_id IN/.test(s)) return [state.existingAllocs || []];
            if (/FROM po_lot_allocations WHERE \(po_detail_id, lot_id, id_batch\) IN/.test(s)) return [[]];
            if (/FROM po_details WHERE po_detail_id IN/.test(s)) return [[{ po_detail_id: 2, po_header_id: 20, base_qty: 100, fulfilled_qty: 25 }]];
            return [{}];
        }
    };
};
const find = (conn, re) => conn.calls.filter((c) => re.test(c.sql.replace(/\s+/g, ' ')));
const issueCalc = () => ({
    newRows: [{ batchNumber: '', lotNumber: 'L1', itemCode: 'P1', lotStatus: 'GOOD', transType: 'Good Issue Sample QC', qtyPac: 15, actualCompletedDatetime: '2026-03-01 10:00:00', expiredDate: '2027-02-01', rowHash: 'x1', docSource: '499600' }],
    previewResults: [{ lotOnly: true, batchNumber: '', lotNumber: 'L1', idProduct: 1, actualCompletedDatetime: '2026-03-01 10:00:00', expiredDate: '2027-02-01' }],
    detailedAllocations: [{ poDetailId: 2, batchNumber: 'B2', batchId: 12, lotNumber: 'L1', idProduct: 1, addedQty: -15, rowStatus: 'Open', transType: 'Good Issue Sample QC' }]
});
const commitArgs = (calculation) => ({ fileName: 'f.xlsx', processTimestamp: '2026-03-01 10:00:00', fileHash: 'h', userId: 4, calculation });

test.beforeEach(() => { statusCalls.length = 0; });

test('commit issue: batch kosong tersimpan, lot tidak diubah, batch tidak dibuat, alokasi batch lain dikurangi', async () => {
    const conn = makeConn({ existingAllocs: [{ id: 900, po_detail_id: 2, lot_id: 5, id_batch: 12, allocated_qty: 40, status: 'Open' }] });
    const result = await commitProductionAllocationTransaction(conn, commitArgs(issueCalc()));
    assert.equal(result.allocationCount, 1);

    const detailInsert = find(conn, /^INSERT INTO production_lot_upload_details/)[0];
    assert.equal(detailInsert.params[0][0][1], '');           // batch_number kosong (kolom NOT NULL)
    assert.equal(detailInsert.params[0][0][5], 'Good Issue Sample QC');
    assert.equal(detailInsert.params[0][0][6], 15);           // qty_pac disimpan positif
    assert.equal(detailInsert.params[0][0][10], '499600');    // Doc Source hanya referensi (kolom doc_source)
    assert.match(detailInsert.sql, /row_hash, doc_source\)/);

    // riwayat alokasi mencatat jenis transaksi
    const logRow = find(conn, /po_lot_allocation_logs/)[0].params[0][0];
    assert.equal(logRow[11], 'Good Issue Sample QC');

    assert.equal(find(conn, /^INSERT INTO lots/).length, 0);    // issue tidak mengubah tanggal selesai lot
    assert.equal(find(conn, /^INSERT INTO batches/).length, 0);
    assert.deepEqual(find(conn, /^INSERT INTO po_lot_allocations/)[0].params[0], [[2, 5, 12, 25, 'Open', 4, 4]]);
    assert.deepEqual(statusCalls.find((c) => c[0] === 'batches'), ['batches', [12]]);
});

test('commit issue: pengurangan melebihi alokasi tersimpan ditolak (negatif)', async () => {
    const conn = makeConn({ existingAllocs: [{ id: 900, po_detail_id: 2, lot_id: 5, id_batch: 12, allocated_qty: 10, status: 'Open' }] });
    await assert.rejects(commitProductionAllocationTransaction(conn, commitArgs(issueCalc())), (e) => e.status === 422 && /negative/.test(JSON.stringify(e.details || e.message || e)));
});

test('commit: completion batch baru dan issue pada lot yang sama dalam satu file menjadi satu alokasi bersih', async () => {
    const calc = {
        newRows: [
            { batchNumber: 'B9', lotNumber: 'L1', itemCode: 'P1', lotStatus: 'GOOD', transType: 'WIP Completion', qtyPac: 50, actualCompletedDatetime: '2026-02-01 10:00:00', expiredDate: '2027-02-01', rowHash: 'a' },
            { batchNumber: '', lotNumber: 'L1', itemCode: 'P1', lotStatus: 'GOOD', transType: 'WIP Issue', qtyPac: 20, actualCompletedDatetime: '2026-02-05 10:00:00', expiredDate: '2027-02-01', rowHash: 'b' }
        ],
        previewResults: [
            { batchNumber: 'B9', lotNumber: 'L1', idProduct: 1, actualCompletedDatetime: '2026-02-01 10:00:00', expiredDate: '2027-02-01' },
            { lotOnly: true, batchNumber: '', lotNumber: 'L1', idProduct: 1, actualCompletedDatetime: '2026-02-05 10:00:00', expiredDate: '2027-02-01' }
        ],
        detailedAllocations: [
            { poDetailId: 2, batchNumber: 'B9', batchId: null, lotNumber: 'L1', idProduct: 1, addedQty: 50, rowStatus: 'Open' },
            { poDetailId: 2, batchNumber: 'B9', batchId: null, lotNumber: 'L1', idProduct: 1, addedQty: -20, rowStatus: 'Open' }
        ]
    };
    const conn = makeConn({ createdBatches: [{ id: 21, batch_number: 'B9' }] });
    await commitProductionAllocationTransaction(conn, commitArgs(calc));
    // tanggal selesai lot hanya dari completion (bukan tanggal issue)
    assert.deepEqual(find(conn, /^INSERT INTO lots/)[0].params[0], [['L1', 1, '2026-02-01 10:00:00', '2027-02-01']]);
    assert.deepEqual(find(conn, /^INSERT INTO batches/)[0].params[0].map((b) => b[0]), ['B9']);
    assert.deepEqual(find(conn, /^INSERT INTO po_lot_allocations/)[0].params[0], [[2, 5, 21, 30, 'Open', 4, 4]]);
});
