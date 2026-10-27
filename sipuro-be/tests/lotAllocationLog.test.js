'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { logAllocationInsert, logAllocationUpdate, getAllocationLogs } = require('../services/production-lot/lotAllocationLog');

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
