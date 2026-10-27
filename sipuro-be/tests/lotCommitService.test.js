'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const statusCalls = [];
const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: null };
    if (request.endsWith('/helpers/poLogHelper')) return { logPOHeader: async () => {} };
    if (request === './lotStatusService') {
        return {
            refreshPOStatus: async (_c, id) => statusCalls.push(['po', id]),
            refreshBatchStatuses: async (_c, ids) => statusCalls.push(['batches', [...ids].sort()]),
            recalculateFulfilledQty: async (_c, ids) => statusCalls.push(['recalc', ids]),
            syncBatchCompletedDates: async (_c, nums, by) => statusCalls.push(['sync', nums, by])
        };
    }
    return originalLoad.apply(this, arguments);
};
const { commitProductionAllocationTransaction } = require(path.join('..', 'services/production-lot/lotCommitService'));

/**
 * Koneksi tiruan: mencatat query dan menjawab sesuai pola.
 * state: existingBatches, existingAllocs, poDetails, relatedAllocs
 */
const makeConn = (state = {}) => {
    const calls = [];
    return {
        calls,
        query: async (sql, params) => {
            calls.push({ sql, params });
            const s = sql.replace(/\s+/g, ' ').trim();
            if (/^INSERT INTO production_lot_upload_logs/.test(s)) return [{ insertId: 77 }];
            if (/^SELECT id, lot_number, id_product FROM lots/.test(s)) return [state.lots || [{ id: 5, lot_number: 'L1', id_product: 1 }]];
            if (/^SELECT id, batch_number, id_product FROM batches/.test(s)) return [state.existingBatches || []];
            if (/^SELECT id, batch_number FROM batches/.test(s)) return [[{ id: 11, batch_number: 'B1' }]];
            if (/FROM po_lot_allocations WHERE lot_id IN/.test(s)) return [state.existingAllocs || []];
            if (/FROM po_lot_allocations WHERE \(po_detail_id, lot_id, id_batch\) IN/.test(s)) return [[{ id: 900, po_detail_id: 3, lot_id: 5, id_batch: 11 }]];
            if (/FROM po_details WHERE po_detail_id IN/.test(s)) return [state.poDetails || [{ po_detail_id: 3, po_header_id: 30, base_qty: 100, fulfilled_qty: 50 }]];
            if (/^SELECT id, po_detail_id, lot_id, id_batch, allocated_qty, status FROM po_lot_allocations WHERE po_detail_id IN/.test(s)) return [state.relatedAllocs || []];
            return [{}];
        }
    };
};

const calculation = (over = {}) => ({
    newRows: [{
        batchNumber: 'B1', lotNumber: 'L1', itemCode: 'P1', lotStatus: 'GOOD', transType: 'WIP COMPLETION',
        qtyPac: 50, actualCompletedDatetime: '2026-02-01 10:00:00', expiredDate: '2027-02-01', rowHash: 'h1'
    }],
    previewResults: [{
        batchNumber: 'B1', lotNumber: 'L1', idProduct: 1,
        actualCompletedDatetime: '2026-02-01 10:00:00', expiredDate: '2027-02-01'
    }],
    detailedAllocations: [{ poDetailId: 3, batchNumber: 'B1', lotNumber: 'L1', idProduct: 1, addedQty: 50, rowStatus: 'Open' }],
    ...over
});

const args = (calc = calculation()) => ({ fileName: 'f.xlsx', processTimestamp: '2026-02-01 10:00:00', fileHash: 'abc', userId: 4, calculation: calc });
const find = (conn, re) => conn.calls.filter((c) => re.test(c.sql.replace(/\s+/g, ' ')));

test.beforeEach(() => { statusCalls.length = 0; });

test('alur normal: upsert lot, batch baru, alokasi baru, log, hitung ulang, refresh', async () => {
    const conn = makeConn();
    const result = await commitProductionAllocationTransaction(conn, args());

    assert.deepEqual(result, { uploadLogId: 77, savedBatchCount: 1, savedLotCount: 1, savedRowCount: 1, allocationCount: 1 });

    // Tidak ada pengecekan duplikat ganda di service (dijaga controller + kunci unik)
    assert.equal(find(conn, /SELECT .* FROM production_lot_upload_logs/).length, 0);

    // Upsert lot dengan aturan MAX tanggal dan expired tidak ditimpa
    const lotUpsert = find(conn, /^INSERT INTO lots/)[0];
    assert.match(lotUpsert.sql, /GREATEST/);
    assert.match(lotUpsert.sql, /expired_date = COALESCE\(expired_date, VALUES\(expired_date\)\)/);
    assert.deepEqual(lotUpsert.params[0], [['L1', 1, '2026-02-01 10:00:00', '2027-02-01']]);

    // Tidak ada pembacaan seluruh tabel lots
    find(conn, /FROM lots/).forEach((c) => assert.match(c.sql, /WHERE lot_number IN/));

    // batch_lots tidak lagi ditulis
    assert.equal(find(conn, /batch_lots/).length, 0);

    // Batch baru tanpa tanggal selesai (diisi sync)
    const batchInsert = find(conn, /^INSERT INTO batches/)[0];
    assert.equal(batchInsert.params[0][0][4], null);
    assert.deepEqual(statusCalls.find((c) => c[0] === 'sync'), ['sync', ['B1'], 4]);

    // Alokasi
    const alloc = find(conn, /^INSERT INTO po_lot_allocations/)[0];
    assert.deepEqual(alloc.params[0], [[3, 5, 11, 50, 'Open', 4, 4]]);
    assert.match(alloc.sql, /\(po_detail_id, lot_id, id_batch, allocated_qty/);
    const logInsert = find(conn, /INSERT INTO sipuro_db\.po_lot_allocation_logs/);
    assert.equal(logInsert.length, 1);
    assert.equal(logInsert[0].params[0][0][3], 5); // lot_id
    assert.equal(logInsert[0].params[0][0][4], 11); // id_batch
    assert.equal(logInsert[0].params[0][0][1], 900); // allocation_id hasil pencarian

    assert.deepEqual(statusCalls.find((c) => c[0] === 'recalc'), ['recalc', [3]]);
    assert.deepEqual(statusCalls.find((c) => c[0] === 'batches'), ['batches', [11]]);
    assert.deepEqual(statusCalls.filter((c) => c[0] === 'po'), [['po', 30]]);
});

test('alokasi sudah ada: qty ditambah dan log update', async () => {
    const conn = makeConn({ existingAllocs: [{ id: 900, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 20, status: 'Open' }] });
    await commitProductionAllocationTransaction(conn, args());
    const alloc = find(conn, /^INSERT INTO po_lot_allocations/)[0];
    assert.deepEqual(alloc.params[0], [[3, 5, 11, 70, 'Open', 4, 4]]);
    // Tidak ada query pencarian id alokasi baru (karena bukan insert)
    assert.equal(find(conn, /WHERE \(po_detail_id, lot_id, id_batch\) IN/).length, 0);
});

test('lot sama di dua grup: digabung dengan MAX tanggal, satu baris upsert', async () => {
    const calc = calculation({
        previewResults: [
            { batchNumber: 'B1', lotNumber: 'L1', idProduct: 1, actualCompletedDatetime: '2026-02-01 10:00:00', expiredDate: null },
            { batchNumber: 'B2', lotNumber: 'L1', idProduct: 1, actualCompletedDatetime: '2026-03-01 10:00:00', expiredDate: '2027-01-01' }
        ]
    });
    const conn = makeConn();
    await commitProductionAllocationTransaction(conn, args(calc));
    const lotUpsert = find(conn, /^INSERT INTO lots/)[0];
    assert.deepEqual(lotUpsert.params[0], [['L1', 1, '2026-03-01 10:00:00', '2027-01-01']]);
});

test('qty alokasi menjadi negatif: 422 dan tidak ada tulis alokasi', async () => {
    const conn = makeConn({ existingAllocs: [{ id: 900, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 10, status: 'Open' }] });
    const calc = calculation({ detailedAllocations: [{ poDetailId: 3, batchNumber: 'B1', lotNumber: 'L1', idProduct: 1, addedQty: -30, rowStatus: 'Open' }] });
    await assert.rejects(commitProductionAllocationTransaction(conn, args(calc)), (e) => e.status === 422);
    assert.equal(find(conn, /^INSERT INTO po_lot_allocations/).length, 0);
});

test('alokasi lama berstatus Force Closed tidak boleh diubah: 422', async () => {
    const conn = makeConn({ existingAllocs: [{ id: 900, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 10, status: 'Force Closed' }] });
    await assert.rejects(commitProductionAllocationTransaction(conn, args()), (e) => e.status === 422);
});

test('fulfilled melebihi base_qty setelah hitung ulang: 409', async () => {
    const conn = makeConn({ poDetails: [{ po_detail_id: 3, po_header_id: 30, base_qty: 100, fulfilled_qty: 120 }] });
    await assert.rejects(commitProductionAllocationTransaction(conn, args()), (e) => e.status === 409);
});

test('batch sudah milik produk lain: 422 sebelum menulis batch/alokasi', async () => {
    const conn = makeConn({ existingBatches: [{ id: 11, batch_number: 'B1', id_product: 2 }] });
    await assert.rejects(commitProductionAllocationTransaction(conn, args()), (e) => e.status === 422);
    assert.equal(find(conn, /^INSERT INTO batches/).length, 0);
    assert.equal(find(conn, /^INSERT INTO po_lot_allocations/).length, 0);
});

test('sinkronisasi status: alokasi saudara (lot/batch lain, item PO sama) diubah dan batch-nya ikut di-refresh', async () => {
    const conn = makeConn({
        existingBatches: [{ id: 11, batch_number: 'B1', id_product: 1 }],
        relatedAllocs: [
            { id: 901, po_detail_id: 3, lot_id: 6, id_batch: 12, allocated_qty: 10, status: 'Closed' },
            { id: 902, po_detail_id: 3, lot_id: 6, id_batch: 13, allocated_qty: 10, status: 'Closed' }
        ],
        poDetails: [{ po_detail_id: 3, po_header_id: 30, base_qty: 100, fulfilled_qty: 50 }]
    });
    await commitProductionAllocationTransaction(conn, args());
    const updates = find(conn, /^UPDATE po_lot_allocations SET status/);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0].params, ['Open', 4, [901, 902]]);
    // Log sinkronisasi membawa id_batch tiap alokasi saudara
    const syncLog = find(conn, /INSERT INTO sipuro_db\.po_lot_allocation_logs/).pop();
    assert.deepEqual(syncLog.params[0].map((r) => r[4]), [12, 13]);
    // Query saudara tidak lagi memakai batch_lots
    assert.ok(!find(conn, /LEFT JOIN batch_lots/).length);
    const refreshed = statusCalls.find((c) => c[0] === 'batches')[1];
    assert.deepEqual(refreshed, [11, 12, 13]);
});

test('lot yang sama di dua batch: dua alokasi terpisah per (item PO, lot, batch)', async () => {
    const conn = makeConn({
        existingBatches: [{ id: 11, batch_number: 'B1', id_product: 1 }, { id: 12, batch_number: 'B2', id_product: 1 }],
        poDetails: [{ po_detail_id: 3, po_header_id: 30, base_qty: 100, fulfilled_qty: 60 }]
    });
    const calc = calculation({
        previewResults: [
            { batchNumber: 'B1', lotNumber: 'L1', idProduct: 1, actualCompletedDatetime: '2026-02-01 10:00:00', expiredDate: null },
            { batchNumber: 'B2', lotNumber: 'L1', idProduct: 1, actualCompletedDatetime: '2026-02-02 10:00:00', expiredDate: null }
        ],
        detailedAllocations: [
            { poDetailId: 3, batchNumber: 'B1', lotNumber: 'L1', idProduct: 1, addedQty: 30, rowStatus: 'Open' },
            { poDetailId: 3, batchNumber: 'B2', lotNumber: 'L1', idProduct: 1, addedQty: 30, rowStatus: 'Open' }
        ]
    });
    await commitProductionAllocationTransaction(conn, args(calc));
    const alloc = find(conn, /^INSERT INTO po_lot_allocations/)[0];
    assert.deepEqual(alloc.params[0], [[3, 5, 11, 30, 'Open', 4, 4], [3, 5, 12, 30, 'Open', 4, 4]]);
});

test('batch tidak ditemukan untuk alokasi: 422', async () => {
    const conn = makeConn();
    const calc = calculation({
        detailedAllocations: [{ poDetailId: 3, batchNumber: 'BX', lotNumber: 'L1', idProduct: 1, addedQty: 5, rowStatus: 'Open' }]
    });
    await assert.rejects(commitProductionAllocationTransaction(conn, args(calc)), (e) => e.status === 422);
});
