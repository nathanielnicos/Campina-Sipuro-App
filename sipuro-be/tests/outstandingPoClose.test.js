'use strict';

/**
 * Tes alur Close PO Item (controllers/outstanding-po/outstandingCloseController.js).
 * Memakai "dunia" tiruan di memori: header dan item PO, transaksi, log, sinkron status, dan notifikasi.
 * Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

let world = null;
let connectionRequests = 0;
let notifyThrows = false;

const dbStub = { sipuroDb: { getConnection: async () => { connectionRequests += 1; return world.conn; } } };

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request.endsWith('/config/db')) return dbStub;
    if (request.endsWith('/helpers/notificationHelper')) {
        return {
            createNotification: async (payload) => {
                world.events.push('notify');
                world.notifications.push(payload);
                if (notifyThrows) throw new Error('smtp down');
            }
        };
    }
    if (request.endsWith('/helpers/poLogHelper')) {
        return {
            logPOHeader: async (_conn, args) => { world.events.push('logHeader'); world.headerLogs.push(args); return 99; },
            logPODetails: async (_conn, id, logs) => { world.events.push('logDetails'); world.detailLogs.push({ id, logs }); }
        };
    }
    if (request.endsWith('/lotStatusService')) {
        return {
            refreshPOStatus: async (_conn, id) => { world.events.push('sync'); world.syncCalls.push(id); },
            refreshBatchStatuses: async (_conn, ids) => { world.events.push('refreshBatches'); world.batchRefreshes.push(ids); }
        };
    }
    if (request.endsWith('/lotAllocationLog')) {
        return {
            logAllocationUpdate: async (_conn, logs, by) => { world.events.push('logAlloc'); world.allocLogs.push({ logs, by }); }
        };
    }
    return originalLoad.apply(this, arguments);
};

const { requestClose, approveClose, rejectClose } = require('../controllers/outstanding-po/outstandingCloseController');

const CUSTOMER = { id: 3, type: 'CUSTOMER', customerId: 7, companyName: 'PT Maju' };
const OTHER_CUSTOMER = { id: 4, type: 'CUSTOMER', customerId: 8, companyName: 'PT Lain' };
const PPIC = { id: 20, type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' };

const makeWorld = (overrides = {}) => {
    const w = {
        events: [],
        queries: [],
        headerLogs: [],
        detailLogs: [],
        notifications: [],
        syncCalls: [],
        batchRefreshes: [],
        allocLogs: [],
        allocUpdates: [],
        allocations: overrides.allocations || [],
        lockBusy: Boolean(overrides.lockBusy),
        updateAffected: overrides.updateAffected === undefined ? 1 : overrides.updateAffected,
        failOnUpdate: overrides.failOnUpdate || null,
        header: { po_header_id: 1, po_number: 'PO-1', customer_id: 7, status: 'Approved', ...(overrides.header || {}) },
        detail: overrides.detail === null ? null : {
            po_detail_id: 10, po_header_id: 1, id_product: 5, qty: 100, base_qty: 100, fulfilled_qty: 0,
            total_price: '1000.00', status: 'Active', deleted_at: null, ...(overrides.detail || {})
        },
        product: { product_code: 'FG-1', product_name: 'Produk Satu' }
    };
    w.conn = {
        beginTransaction: async () => { w.events.push('begin'); },
        commit: async () => { w.events.push('commit'); },
        rollback: async () => { w.events.push('rollback'); },
        release: () => { w.events.push('release'); },
        query: async (sql, params) => {
            w.queries.push({ sql, params });
            if (/GET_LOCK/.test(sql)) {
                w.events.push('getLock');
                return [[{ acquired: w.lockBusy ? 0 : 1 }]];
            }
            if (/RELEASE_LOCK/.test(sql)) { w.events.push('releaseLock'); return [[{}]]; }
            if (/^SET TRANSACTION ISOLATION LEVEL READ COMMITTED/.test(sql)) { w.events.push('isolation'); return [{}]; }
            if (/FROM po_lot_allocations\s+WHERE po_detail_id = \?\s+ORDER BY id\s+FOR UPDATE/.test(sql)) {
                w.events.push('lockAllocs');
                return [w.allocations];
            }
            if (/^\s*UPDATE po_lot_allocations SET status = \?, updated_by = \?/.test(sql)) {
                w.events.push('allocUpdate');
                w.allocUpdates.push({ sql, params });
                return [{ affectedRows: params[2].length }];
            }
            if (/^SELECT po_header_id FROM sipuro_db\.po_details WHERE po_detail_id = \?/.test(sql)) {
                w.events.push('ref');
                return [w.detail ? [{ po_header_id: w.detail.po_header_id }] : []];
            }
            if (/FROM sipuro_db\.po_headers WHERE po_header_id = \? FOR UPDATE/.test(sql)) {
                w.events.push('lockHeader');
                return [[w.header]];
            }
            if (/FROM sipuro_db\.po_details WHERE po_detail_id = \? AND po_header_id = \? FOR UPDATE/.test(sql)) {
                w.events.push('lockDetail');
                return [[w.detail]];
            }
            if (/FROM sipuro_db\.products/.test(sql)) return [[w.product]];
            if (/^\s*UPDATE sipuro_db\.po_details/.test(sql)) {
                w.events.push('update');
                w.update = { sql, params };
                if (w.failOnUpdate) throw w.failOnUpdate;
                return [{ affectedRows: w.updateAffected }];
            }
            throw new Error(`query tidak terduga: ${sql}`);
        }
    };
    return w;
};

const makeRes = () => {
    const res = { statusCode: 200, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
};

const call = async (handler, { user, id = '10', body = {} }, overrides) => {
    world = makeWorld(overrides);
    connectionRequests = 0;
    notifyThrows = false;
    const res = makeRes();
    await handler({ user, params: { poDetailId: id }, body }, res);
    return res;
};

const silenceConsole = async (fn) => {
    const original = console.error;
    console.error = () => {};
    try { return await fn(); } finally { console.error = original; }
};

/* ------------------------------ REQUEST CLOSE ------------------------------ */

test('request close: berhasil, urutan kunci -> ubah -> log -> sinkron -> commit -> notifikasi', async () => {
    const res = await call(requestClose, { user: CUSTOMER, body: { reason: '  tidak jadi  ' } });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(world.events, ['begin', 'ref', 'lockHeader', 'lockDetail', 'update', 'logHeader', 'logDetails', 'sync', 'commit', 'release', 'notify']);

    assert.deepEqual(world.update.params, ['tidak jadi', 10]);
    assert.ok(world.update.sql.includes("status = 'Close Requested'"));
    assert.ok(world.update.sql.includes("AND status = 'Active'"), 'UPDATE harus disertai syarat status');

    assert.equal(world.headerLogs[0].actionType, 'REQUEST_CLOSE_ITEM');
    assert.equal(world.headerLogs[0].actionBy, 3);
    assert.equal(world.headerLogs[0].reason, 'tidak jadi');
    assert.equal(world.detailLogs[0].logs[0].old_status, 'Active');
    assert.equal(world.detailLogs[0].logs[0].new_status, 'Close Requested');
    assert.deepEqual(world.syncCalls, [1]);

    const notification = world.notifications[0];
    assert.equal(notification.recipientType, 'EMPLOYEE');
    assert.equal(notification.recipientDepartment, 'PPIC');
    assert.equal(notification.senderType, 'CUSTOMER');
    assert.equal(notification.senderId, 3);
    assert.match(notification.message, /PT Maju.*Produk Satu.*PO-1.*tidak jadi/);
    assert.equal(notification.link, '/outstanding-po?po=PO-1&product=FG-1');
});

test('request close: PO milik perusahaan lain dijawab 404 tanpa mengubah apa pun', async () => {
    const res = await call(requestClose, { user: OTHER_CUSTOMER, body: { reason: 'x' } });
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'PO item not found.');
    assert.ok(!world.events.includes('update'));
    assert.ok(!world.events.includes('notify'));
    assert.ok(world.events.includes('rollback'));
});

test('request close: pengguna selain customer ditolak 404 (pertahanan berlapis)', async () => {
    const res = await call(requestClose, { user: PPIC, body: { reason: 'x' } });
    assert.equal(res.statusCode, 404);
    assert.ok(!world.events.includes('update'));
});

test('request close: PO yang bukan Approved ditolak 400', async () => {
    for (const status of ['Draft', 'Waiting for Confirmation', 'Canceled', 'Rejected', 'Production Completed']) {
        const res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { header: { status } });
        assert.equal(res.statusCode, 400, status);
        assert.ok(!world.events.includes('update'), status);
        assert.ok(!world.events.includes('sync'), status);
    }
});

test('request close: item yang bukan Active ditolak 409', async () => {
    let res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { detail: { status: 'Close Requested' } });
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /already pending/);

    for (const status of ['Closed', 'Partially Closed']) {
        res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { detail: { status } });
        assert.equal(res.statusCode, 409, status);
        assert.match(res.body.message, /already been closed/);
    }
});

test('request close: item yang sudah terpenuhi penuh ditolak; fulfilled_qty NULL dianggap 0', async () => {
    let res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { detail: { fulfilled_qty: 100, base_qty: 100 } });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /fully produced/);

    res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { detail: { fulfilled_qty: null } });
    assert.equal(res.statusCode, 200);
});

test('request close: alasan wajib berupa teks 1-50 karakter, diperiksa sebelum database dipakai', async () => {
    for (const reason of [undefined, null, '', '   ', 123, {}, 'x'.repeat(51)]) {
        const res = await call(requestClose, { user: CUSTOMER, body: { reason } });
        assert.equal(res.statusCode, 400, String(reason));
        assert.equal(connectionRequests, 0, String(reason));
    }
    const res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x'.repeat(50) } });
    assert.equal(res.statusCode, 200);
});

test('request close: ID item tidak valid ditolak 400 tanpa database', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '', ' ', '99999999999', '1;DROP']) {
        const res = await call(requestClose, { user: CUSTOMER, id, body: { reason: 'x' } });
        assert.equal(res.statusCode, 400, id);
        assert.equal(connectionRequests, 0, id);
    }
});

test('request close: item tidak ada atau sudah dihapus dijawab 404', async () => {
    let res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { detail: null });
    assert.equal(res.statusCode, 404);

    res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { detail: { deleted_at: '2026-10-01 00:00:00' } });
    assert.equal(res.statusCode, 404);
    assert.ok(!world.events.includes('update'));
});

test('request close: UPDATE tidak mengenai baris (aksi lain mendahului) -> 409, batal total', async () => {
    const res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { updateAffected: 0 });
    assert.equal(res.statusCode, 409);
    for (const forbidden of ['logHeader', 'logDetails', 'sync', 'commit', 'notify']) {
        assert.ok(!world.events.includes(forbidden), forbidden);
    }
    assert.ok(world.events.includes('rollback'));
});

test('request close: deadlock database dijawab 409 yang ramah, bukan 500', async () => {
    const deadlock = Object.assign(new Error('Deadlock found'), { code: 'ER_LOCK_DEADLOCK' });
    const res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { failOnUpdate: deadlock });
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /Another update is in progress/);
    assert.ok(world.events.includes('rollback'));
});

test('request close: error tak terduga dijawab 500 generik dan dibatalkan', async () => {
    await silenceConsole(async () => {
        const res = await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { failOnUpdate: new Error('rahasia: detail SQL') });
        assert.equal(res.statusCode, 500);
        assert.ok(!JSON.stringify(res.body).includes('rahasia'));
        assert.ok(world.events.includes('rollback'));
    });
});

test('request close: kegagalan notifikasi tidak membatalkan hasil yang sudah tersimpan', async () => {
    world = makeWorld();
    connectionRequests = 0;
    notifyThrows = true;
    const res = makeRes();
    await silenceConsole(() => requestClose({ user: CUSTOMER, params: { poDetailId: '10' }, body: { reason: 'x' } }, res));
    assert.equal(res.statusCode, 200);
    assert.ok(world.events.includes('commit'));
    assert.ok(!world.events.includes('rollback'));
});

/* ------------------------------ APPROVE CLOSE ------------------------------ */

test('approve: belum ada hasil produksi -> Closed, dengan log, sinkron, dan notifikasi ke customer', async () => {
    const res = await call(approveClose, { user: PPIC }, { detail: { status: 'Close Requested', fulfilled_qty: 0 } });

    assert.equal(res.statusCode, 200);
    assert.match(res.body.message, /Closed/);
    assert.deepEqual(world.events, [
        'getLock', 'isolation', 'begin', 'ref', 'lockHeader', 'lockDetail', 'update', 'logHeader', 'logDetails',
        'lockAllocs', 'sync', 'commit', 'releaseLock', 'release', 'notify'
    ]);
    assert.deepEqual(world.update.params, ['Closed', 10]);
    assert.equal(world.allocUpdates.length, 0, 'tanpa alokasi: hanya status item yang berubah');
    assert.equal(world.allocLogs.length, 0);
    assert.equal(world.batchRefreshes.length, 0);
    assert.ok(world.update.sql.includes("AND status = 'Close Requested'"), 'UPDATE harus disertai syarat status');
    assert.equal(world.headerLogs[0].actionType, 'APPROVE_CLOSE_ITEM');
    assert.equal(world.headerLogs[0].actionBy, 20);
    assert.equal(world.detailLogs[0].logs[0].old_status, 'Close Requested');
    assert.equal(world.detailLogs[0].logs[0].new_status, 'Closed');

    const notification = world.notifications[0];
    assert.equal(notification.recipientType, 'CUSTOMER');
    assert.equal(notification.recipientId, 7);
    assert.equal(notification.senderType, 'EMPLOYEE');
    assert.equal(notification.senderId, 20);
});

test('approve: sudah ada hasil produksi sebagian -> Partially Closed (angka teks pun dibaca benar)', async () => {
    for (const fulfilled of [40, '40']) {
        const res = await call(approveClose, { user: PPIC }, { detail: { status: 'Close Requested', fulfilled_qty: fulfilled } });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(world.update.params, ['Partially Closed', 10]);
        assert.equal(world.detailLogs[0].logs[0].new_status, 'Partially Closed');
    }
});

test('approve: tanpa pengajuan yang menunggu ditolak 409', async () => {
    for (const status of ['Active', 'Closed', 'Partially Closed']) {
        const res = await call(approveClose, { user: PPIC }, { detail: { status } });
        assert.equal(res.statusCode, 409, status);
        assert.match(res.body.message, /no pending close request/i);
        assert.ok(!world.events.includes('update'), status);
    }
});

test('approve: aksi lain mendahului (UPDATE tidak mengenai baris) -> 409, batal total', async () => {
    const res = await call(approveClose, { user: PPIC }, { detail: { status: 'Close Requested' }, updateAffected: 0 });
    assert.equal(res.statusCode, 409);
    for (const forbidden of ['logHeader', 'logDetails', 'sync', 'commit', 'notify']) {
        assert.ok(!world.events.includes(forbidden), forbidden);
    }
});

test('approve: status header yang diterima Approved dan Production Completed saja', async () => {
    for (const status of ['Approved', 'Production Completed']) {
        const res = await call(approveClose, { user: PPIC }, { detail: { status: 'Close Requested' }, header: { status } });
        assert.equal(res.statusCode, 200, status);
    }
    for (const status of ['Draft', 'Waiting for Confirmation', 'Canceled', 'Rejected']) {
        const res = await call(approveClose, { user: PPIC }, { detail: { status: 'Close Requested' }, header: { status } });
        assert.equal(res.statusCode, 400, status);
        assert.ok(!world.events.includes('update'), status);
    }
});

/* ------------------------------ REJECT CLOSE ------------------------------- */

test('reject: item kembali Active dan alasan pengajuan dibersihkan', async () => {
    const res = await call(rejectClose, { user: PPIC }, { detail: { status: 'Close Requested' } });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(world.events, ['begin', 'ref', 'lockHeader', 'lockDetail', 'update', 'logHeader', 'logDetails', 'sync', 'commit', 'release', 'notify']);
    assert.ok(world.update.sql.includes("status = 'Active', close_reason = NULL"));
    assert.ok(world.update.sql.includes("AND status = 'Close Requested'"), 'UPDATE harus disertai syarat status');
    assert.deepEqual(world.update.params, [10]);
    assert.equal(world.headerLogs[0].actionType, 'REJECT_CLOSE_ITEM');
    assert.equal(world.headerLogs[0].actionBy, 20);
    assert.equal(world.headerLogs[0].reason, null);
    assert.equal(world.detailLogs[0].logs[0].new_status, 'Active');
    assert.equal(world.notifications[0].recipientId, 7);
});

test('reject: tanpa pengajuan yang menunggu ditolak 409; aksi yang didahului juga 409', async () => {
    let res = await call(rejectClose, { user: PPIC }, { detail: { status: 'Active' } });
    assert.equal(res.statusCode, 409);

    res = await call(rejectClose, { user: PPIC }, { detail: { status: 'Close Requested' }, updateAffected: 0 });
    assert.equal(res.statusCode, 409);
    assert.ok(!world.events.includes('commit'));
    assert.ok(!world.events.includes('notify'));
});

/* --------------- APPROVE: alokasi lot Open menjadi Force Closed --------------- */

const alloc = (id, status, qty, batch = 500) => ({
    id, po_detail_id: 10, lot_id: 900 + id, id_batch: batch, allocated_qty: qty, status
});

test('approve: semua alokasi Open (termasuk qty 0) menjadi Force Closed dengan riwayat dan refresh batch', async () => {
    const allocations = [alloc(1, 'Open', 40), alloc(2, 'Open', 0, 501), alloc(3, 'Closed', 10), alloc(4, 'Canceled', 5), alloc(5, 'Force Closed', 7)];
    const res = await call(approveClose, { user: PPIC }, {
        detail: { status: 'Close Requested', fulfilled_qty: 57 }, allocations
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(world.update.params, ['Partially Closed', 10]);
    assert.deepEqual(world.events, [
        'getLock', 'isolation', 'begin', 'ref', 'lockHeader', 'lockDetail', 'update', 'logHeader', 'logDetails',
        'lockAllocs', 'allocUpdate', 'logAlloc', 'refreshBatches', 'sync', 'commit', 'releaseLock', 'release', 'notify'
    ]);

    assert.equal(world.allocUpdates.length, 1);
    assert.deepEqual(world.allocUpdates[0].params, ['Force Closed', 20, [1, 2], 'Open']);

    const { logs, by } = world.allocLogs[0];
    assert.equal(by, 20);
    assert.deepEqual(logs.map((l) => l.allocation_id), [1, 2]);
    for (const l of logs) {
        assert.equal(l.old_status, 'Open');
        assert.equal(l.new_status, 'Force Closed');
        assert.equal(l.old_allocated_qty, l.new_allocated_qty, 'qty tidak berubah');
        assert.equal(l.po_detail_id, 10);
        assert.ok(l.reason && l.reason.length <= 50);
        assert.equal(l.created_by, 20);
    }
    assert.equal(logs[1].new_allocated_qty, 0);
    assert.deepEqual(world.batchRefreshes, [[500, 501]]);
});

test('approve: tidak ada alokasi Open -> alokasi tidak diubah, tidak ada riwayat, batch tidak disegarkan', async () => {
    const res = await call(approveClose, { user: PPIC }, {
        detail: { status: 'Close Requested', fulfilled_qty: 10 },
        allocations: [alloc(3, 'Closed', 10), alloc(4, 'Canceled', 5), alloc(5, 'Force Closed', 7)]
    });
    assert.equal(res.statusCode, 200);
    assert.equal(world.allocUpdates.length, 0);
    assert.equal(world.allocLogs.length, 0);
    assert.equal(world.batchRefreshes.length, 0);
});

test('approve: lock bersama diambil SEBELUM kunci baris; lock sibuk -> 409 tanpa menyentuh data', async () => {
    const res = await call(approveClose, { user: PPIC }, { detail: { status: 'Close Requested' }, lockBusy: true });
    assert.equal(res.statusCode, 409);
    assert.deepEqual(world.events.slice(0, 1), ['getLock']);
    for (const forbidden of ['begin', 'lockHeader', 'lockDetail', 'update', 'allocUpdate', 'commit', 'notify', 'releaseLock']) {
        assert.ok(!world.events.includes(forbidden), forbidden);
    }
    assert.ok(world.events.includes('release'), 'koneksi tetap dikembalikan');
});

test('approve: gagal di tengah (aksi lain mendahului) -> alokasi tidak disentuh, rollback, lock dilepas', async () => {
    const res = await call(approveClose, { user: PPIC }, {
        detail: { status: 'Close Requested' }, updateAffected: 0, allocations: [alloc(1, 'Open', 40)]
    });
    assert.equal(res.statusCode, 409);
    assert.ok(!world.events.includes('allocUpdate'));
    assert.ok(!world.events.includes('logAlloc'));
    assert.ok(world.events.includes('rollback'));
    assert.ok(world.events.includes('releaseLock'));
});

test('reject: alokasi lot tidak disentuh dan lock bersama tidak dipakai', async () => {
    await call(rejectClose, { user: PPIC }, { detail: { status: 'Close Requested' }, allocations: [alloc(1, 'Open', 40)] });
    for (const forbidden of ['getLock', 'lockAllocs', 'allocUpdate', 'logAlloc', 'refreshBatches']) {
        assert.ok(!world.events.includes(forbidden), forbidden);
    }
});

test('request close: alokasi lot tidak disentuh dan lock bersama tidak dipakai', async () => {
    await call(requestClose, { user: CUSTOMER, body: { reason: 'x' } }, { allocations: [alloc(1, 'Open', 40)] });
    for (const forbidden of ['getLock', 'lockAllocs', 'allocUpdate', 'logAlloc', 'refreshBatches']) {
        assert.ok(!world.events.includes(forbidden), forbidden);
    }
});
