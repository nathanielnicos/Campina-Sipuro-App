'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const headerLogs = [];
const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: null };
    if (request.endsWith('/helpers/poLogHelper')) return { logPOHeader: async (_c, p) => { headerLogs.push(p); } };
    return originalLoad.apply(this, arguments);
};
const svc = require(path.join('..', 'services/production-lot/lotStatusService'));

const fakeConn = (handler) => {
    const calls = [];
    return { calls, query: async (sql, params) => { calls.push({ sql, params }); return handler(sql, params, calls); } };
};

test('recalculateFulfilledQty: kosong tidak query, unik dan memakai rumus bersama', async () => {
    const empty = fakeConn(() => [[]]);
    await svc.recalculateFulfilledQty(empty, [null, 0]);
    assert.equal(empty.calls.length, 0);

    const c = fakeConn(() => [{}]);
    await svc.recalculateFulfilledQty(c, [3, 3, 4]);
    assert.equal(c.calls.length, 1);
    assert.deepEqual(c.calls[0].params, [[3, 4]]);
    assert.match(c.calls[0].sql, /pla\.status <> 'Canceled'/);
});

test('syncBatchCompletedDates: COLLATE, parameter, dan lewati input kosong', async () => {
    const none = fakeConn(() => [{}]);
    await svc.syncBatchCompletedDates(none, [null, ''], 1);
    assert.equal(none.calls.length, 0);

    const c = fakeConn(() => [{}]);
    await svc.syncBatchCompletedDates(c, ['B1', 'B1', 'B2'], 9);
    assert.match(c.calls[0].sql, /COLLATE utf8mb4_unicode_ci/);
    assert.match(c.calls[0].sql, /MAX\(actual_completed_datetime\)/);
    assert.match(c.calls[0].sql, /COALESCE\(d\.max_completed, b\.actual_completed_date\)/);
    assert.deepEqual(c.calls[0].params, [['B1', 'B2'], 9]);
});

test('resolveBatchStatus', () => {
    assert.equal(svc.resolveBatchStatus(['Canceled', 'Canceled']), 'Canceled');
    assert.equal(svc.resolveBatchStatus(['Closed', 'Open']), 'Open');
    assert.equal(svc.resolveBatchStatus(['Closed', 'Force Closed']), 'Force Closed');
    assert.equal(svc.resolveBatchStatus(['Closed', 'Canceled']), 'Closed');
});

test('refreshBatchStatuses: hanya batch yang berubah di-update, dikelompokkan per status', async () => {
    const c = fakeConn((sql) => {
        if (/FROM batches/.test(sql)) return [[{ id: 1, status: 'Open' }, { id: 2, status: 'Open' }, { id: 3, status: 'Open' }, { id: 4, status: 'Open' }]];
        if (/FROM po_lot_allocations/.test(sql)) return [[
            { batch_id: 1, status: 'Closed' }, { batch_id: 2, status: 'Closed' },
            { batch_id: 3, status: 'Open' }
        ]];
        return [{}];
    });
    await svc.refreshBatchStatuses(c, [1, 2, 3, 4, 1]);
    const updates = c.calls.filter((x) => /^UPDATE batches/.test(x.sql.trim()));
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0].params, ['Closed', [1, 2]]);

    // Status batch dibaca dari alokasi yang menunjuk batch itu, bukan dari batch_lots
    const read = c.calls.find((x) => /FROM po_lot_allocations/.test(x.sql));
    assert.match(read.sql, /id_batch IN \(\?\)/);
    assert.ok(!c.calls.some((x) => /batch_lots/.test(x.sql)));

    const none = fakeConn(() => [[]]);
    await svc.refreshBatchStatuses(none, []);
    assert.equal(none.calls.length, 0);
});

const poConn = (status, details, sums) => fakeConn((sql) => {
    if (/SELECT status FROM po_headers/.test(sql)) return [status ? [{ status }] : []];
    if (/FROM po_details/.test(sql)) return [details];
    if (/FROM po_lot_allocations/.test(sql)) return [sums];
    return [{}];
});

test('refreshPOStatus: semua terpenuhi dan Closed -> Production Completed', async () => {
    headerLogs.length = 0;
    const c = poConn('Approved', [{ po_detail_id: 1, base_qty: 10, status: 'Active' }],
        [{ po_detail_id: 1, total_allocated_qty: 10, open_count: 0 }]);
    await svc.refreshPOStatus(c, 5);
    assert.ok(c.calls.some((x) => /UPDATE po_headers/.test(x.sql) && x.params[0] === 'Production Completed'));
    assert.equal(headerLogs.length, 1);
    assert.equal(headerLogs[0].newStatus, 'Production Completed');
});

test('refreshPOStatus: masih ada alokasi Open -> kembali Approved', async () => {
    headerLogs.length = 0;
    const c = poConn('Production Completed', [{ po_detail_id: 1, base_qty: 10, status: 'Active' }],
        [{ po_detail_id: 1, total_allocated_qty: 10, open_count: 1 }]);
    await svc.refreshPOStatus(c, 5);
    assert.ok(c.calls.some((x) => /UPDATE po_headers/.test(x.sql) && x.params[0] === 'Approved'));
});

test('refreshPOStatus: Close Requested -> Approved; header tidak eligible/ tidak ada -> tanpa perubahan', async () => {
    const a = poConn('Production Completed', [{ po_detail_id: 1, base_qty: 10, status: 'Close Requested' }], []);
    await svc.refreshPOStatus(a, 5);
    assert.ok(a.calls.some((x) => /UPDATE po_headers/.test(x.sql) && x.params[0] === 'Approved'));

    const b = poConn('Draft', [], []);
    await svc.refreshPOStatus(b, 5);
    assert.equal(b.calls.length, 1);

    const m = poConn(null, [], []);
    await svc.refreshPOStatus(m, 5);
    assert.equal(m.calls.length, 1);
});

test('refreshPOStatus: tanpa item aktif dan tanpa item Closed -> tidak berubah; status sama -> tidak update', async () => {
    const a = poConn('Approved', [{ po_detail_id: 1, base_qty: 10, status: 'Canceled' }], []);
    await svc.refreshPOStatus(a, 5);
    assert.ok(!a.calls.some((x) => /UPDATE po_headers/.test(x.sql)));

    const b = poConn('Approved', [{ po_detail_id: 1, base_qty: 10, status: 'Active' }], []);
    await svc.refreshPOStatus(b, 5);
    assert.ok(!b.calls.some((x) => /UPDATE po_headers/.test(x.sql)));
});

test('getPOTolerance', async () => {
    const ok = { query: async () => [[{ po_tolerance_percent: '5.5' }]] };
    assert.equal(await svc.getPOTolerance(ok), 0.055);
    const zero = { query: async () => [[{ po_tolerance_percent: 0 }]] };
    assert.equal(await svc.getPOTolerance(zero), 0);
    for (const bad of [[[]], [[{ po_tolerance_percent: null }]]]) {
        await assert.rejects(svc.getPOTolerance({ query: async () => bad }), /not configured/);
    }
});

test('syncAllocationStatuses: menyamakan status alokasi Open/Closed per item PO, mencatat riwayat, mengembalikan batch yang berubah', async () => {
    const allocs = [
        { id: 1, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 10, status: 'Closed' },
        { id: 2, po_detail_id: 3, lot_id: 6, id_batch: 12, allocated_qty: 20, status: 'Closed' },
        { id: 3, po_detail_id: 3, lot_id: 7, id_batch: 12, allocated_qty: 5, status: 'Open' },
        { id: 4, po_detail_id: 4, lot_id: 5, id_batch: 11, allocated_qty: 5, status: 'Open' }
    ];
    const c = fakeConn((sql) => (/^SELECT id, po_detail_id/.test(sql.replace(/\s+/g, ' ').trim()) ? [allocs] : [{}]));
    const batches = await svc.syncAllocationStatuses(c, {
        targetStatusByDetail: new Map([[3, 'Open'], [4, 'Closed']]),
        userId: 9, uploadLogId: 77, reason: 'sync alasan'
    });

    assert.deepEqual(batches.sort(), [11, 12]);
    const updates = c.calls.filter((x) => /^UPDATE po_lot_allocations/.test(x.sql.trim()));
    assert.deepEqual(updates.map((u) => u.params), [['Closed', 9, [4]], ['Open', 9, [1, 2]]]);

    const log = c.calls.find((x) => /po_lot_allocation_logs/.test(x.sql));
    const rows = log.params[0];
    assert.deepEqual(rows.map((r) => r[1]).sort(), [1, 2, 4]);
    assert.ok(rows.every((r) => r[4] === 11 || r[4] === 12));
    assert.ok(rows.every((r) => r[5] === 'UPDATE' && r[0] === 77 && r[10] === 'sync alasan' && r[11] === 9));
    // qty tidak berubah pada log sinkron
    assert.ok(rows.every((r) => r[6] === r[7]));
    assert.deepEqual(rows.map((r) => [r[1], r[8], r[9]]).sort((a, b) => a[0] - b[0]), [[1, 'Closed', 'Open'], [2, 'Closed', 'Open'], [4, 'Open', 'Closed']]);
});

test('syncAllocationStatuses: hanya Open/Closed dibaca, tanpa target -> tanpa query, status sudah sesuai -> tanpa update', async () => {
    const none = fakeConn(() => [[]]);
    assert.deepEqual(await svc.syncAllocationStatuses(none, { targetStatusByDetail: new Map(), userId: 1, reason: 'x' }), []);
    assert.equal(none.calls.length, 0);

    const c = fakeConn((sql) => (/^SELECT/.test(sql.trim()) ? [[{ id: 1, po_detail_id: 3, lot_id: 5, id_batch: 11, allocated_qty: 1, status: 'Open' }]] : [{}]));
    const out = await svc.syncAllocationStatuses(c, { targetStatusByDetail: new Map([[3, 'Open']]), userId: 1, reason: 'x' });
    assert.deepEqual(out, []);
    assert.equal(c.calls.length, 1);
    assert.deepEqual(c.calls[0].params[1], ['Open', 'Closed']);
});
