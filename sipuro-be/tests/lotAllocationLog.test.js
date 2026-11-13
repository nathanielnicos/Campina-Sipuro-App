'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { logAllocationInsert, logAllocationUpdate, getAllocationLogs } = require('../services/production-lot/lotAllocationLog');

const log = require('../services/production-lot/lotAllocationLog');
const { MANUAL_ADJUSTMENT_TYPE, REVERSAL_TYPE, SHIFT_TYPE } = require('../services/production-lot/lotRebalanceTypes');

const conn = () => {
    const calls = [];
    return { calls, query: async (sql, params) => { calls.push({ sql, params }); return [[{ totalItems: 0 }]]; } };
};

test('log insert menyimpan id_batch pada posisi setelah lot_id', async () => {
    const c = conn();
    await logAllocationInsert(c, { upload_log_id: 1, allocation_id: 2, po_detail_id: 3, lot_id: 4, id_batch: 5, allocated_qty: 10, status: 'Open' }, 9);
    assert.match(c.calls[0].sql, /lot_id, id_batch, action_type/);
    assert.deepEqual(c.calls[0].params[0][0].slice(0, 6), [1, 2, 3, 4, 5, 'INSERT']);
});

test('log update menerima id_batch gaya camelCase dan snake_case', async () => {
    const c = conn();
    await logAllocationUpdate(c, [
        { allocation_id: 2, po_detail_id: 3, lot_id: 4, id_batch: 5, old_allocated_qty: 1, new_allocated_qty: 2 },
        { allocationId: 6, poDetailId: 7, lotId: 8, idBatch: 9, old_allocated_qty: 1, new_allocated_qty: 2 }
    ], 9);
    const rows = c.calls[0].params[0];
    assert.deepEqual(rows.map((r) => r[4]), [5, 9]);
    assert.ok(rows.every((r) => r[5] === 'UPDATE'));
});

test('log kosong tidak melakukan query; riwayat memuat id_batch', async () => {
    const c = conn();
    await logAllocationInsert(c, []);
    await logAllocationUpdate(c, []);
    assert.equal(c.calls.length, 0);
    await getAllocationLogs(c, 1);
    assert.match(c.calls[1].sql, /log\.id_batch/);
});

// ---------- lots.adjusted_qty (selisih qty manual) ----------

const makeConn = () => {
    const calls = [];
    return { calls, query: async (sql, params) => { calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params }); return [{}]; } };
};
const lotUpdates = (c) => c.calls.filter((x) => /^UPDATE lots SET adjusted_qty/.test(x.sql));
const row = (over) => ({
    allocation_id: 1, po_detail_id: 3, lot_id: 5, id_batch: 11,
    old_allocated_qty: 100, new_allocated_qty: 80, old_status: 'Open', new_status: 'Open',
    reason: 'x', trans_type: MANUAL_ADJUSTMENT_TYPE, created_by: 4, ...over
});

test('adjusted_qty: pengurangan lewat pensil menambah -20 pada lot', async () => {
    const c = makeConn();
    await log.logAllocationUpdate(c, [row()], 4);
    assert.deepEqual(lotUpdates(c).map((x) => x.params), [[-20, 5]]);
    assert.ok(c.calls[0].sql.startsWith('INSERT INTO'), 'riwayat ditulis lebih dulu');
});

test('adjusted_qty: kenaikan lewat pensil menambah +20 (kembali ke 0)', async () => {
    const c = makeConn();
    await log.logAllocationUpdate(c, [row({ old_allocated_qty: 100, new_allocated_qty: 120 })], 4);
    assert.deepEqual(lotUpdates(c).map((x) => x.params), [[20, 5]]);
});

test('adjusted_qty: pembatalan oleh rebalance (Adjustment Reversal) ikut dihitung', async () => {
    const c = makeConn();
    await log.logAllocationUpdate(c, [row({ trans_type: REVERSAL_TYPE, old_allocated_qty: 80, new_allocated_qty: 100 })], 4);
    assert.deepEqual(lotUpdates(c).map((x) => x.params), [[20, 5]]);
});

test('adjusted_qty: jenis lain (Allocation Shift, upload, kosong) tidak mengubah lots', async () => {
    const c = makeConn();
    await log.logAllocationUpdate(c, [
        row({ trans_type: SHIFT_TYPE }),
        row({ trans_type: 'WIP Completion', upload_log_id: 9 }),
        row({ trans_type: null }),
        row({ trans_type: 'Manual Adjustment, Allocation Shift' })
    ], 4);
    assert.equal(lotUpdates(c).length, 0);
});

test('adjusted_qty: beberapa baris pada lot yang sama dijumlahkan, urut id lot', async () => {
    const c = makeConn();
    await log.logAllocationUpdate(c, [
        row({ lot_id: 9, old_allocated_qty: 50, new_allocated_qty: 40 }),
        row({ lot_id: 5, old_allocated_qty: 100, new_allocated_qty: 80 }),
        row({ lot_id: 5, old_allocated_qty: 30, new_allocated_qty: 20 })
    ], 4);
    assert.deepEqual(lotUpdates(c).map((x) => x.params), [[-30, 5], [-10, 9]]);
});

test('adjusted_qty: selisih bersih 0 tidak menulis lots', async () => {
    const c = makeConn();
    await log.logAllocationUpdate(c, [
        row({ old_allocated_qty: 100, new_allocated_qty: 80 }),
        row({ old_allocated_qty: 80, new_allocated_qty: 100, trans_type: REVERSAL_TYPE })
    ], 4);
    assert.equal(lotUpdates(c).length, 0);
});

test('adjusted_qty: format camelCase (lotId, transType) dikenali; tanpa lot diabaikan', async () => {
    const c = makeConn();
    await log.logAllocationUpdate(c, [
        { allocationId: 1, poDetailId: 3, lotId: 7, idBatch: 11, old_allocated_qty: 10, new_allocated_qty: 4, transType: MANUAL_ADJUSTMENT_TYPE },
        { allocationId: 2, poDetailId: 3, idBatch: 11, old_allocated_qty: 10, new_allocated_qty: 4, transType: MANUAL_ADJUSTMENT_TYPE }
    ], 4);
    assert.deepEqual(lotUpdates(c).map((x) => x.params), [[-6, 7]]);
});

test('adjusted_qty: daftar kosong tidak menulis apa pun; INSERT tidak mengubah lots', async () => {
    const c = makeConn();
    await log.logAllocationUpdate(c, [], 4);
    await log.logAllocationInsert(c, [{ allocation_id: 1, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 40, trans_type: MANUAL_ADJUSTMENT_TYPE }], 4);
    assert.equal(lotUpdates(c).length, 0);
});
