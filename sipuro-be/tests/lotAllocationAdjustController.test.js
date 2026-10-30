'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

// Koneksi tiruan bersama: dipakai fake sipuroDb
let actorExists = true;
let lockAcquired = 1;
let events = [];
let getConnectionCalls = 0;
const connection = {
    query: async (sql, params) => {
        events.push(['query', sql.replace(/\s+/g, ' ').trim(), params]);
        if (/GET_LOCK/.test(sql)) return [[{ acquired: lockAcquired }]];
        if (/FROM employees/.test(sql)) return [actorExists ? [{ id: params[0] }] : []];
        return [[]];
    },
    beginTransaction: async () => events.push(['begin']),
    commit: async () => events.push(['commit']),
    rollback: async () => events.push(['rollback']),
    release: () => events.push(['release'])
};
const fakeDb = { getConnection: async () => { getConnectionCalls += 1; return connection; } };

const adjustCalls = [];
let adjustImpl = async () => ({ allocationId: 9, oldAllocatedQty: 1000, newAllocatedQty: 2500, status: 'Open' });

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    if (request.endsWith('/helpers/poLogHelper')) return { logPOHeader: async () => {} };
    if (request === './lotStatusService') return {};
    return originalLoad.apply(this, arguments);
};
const realSvc = require(path.join('..', 'services/production-lot/lotAllocationAdjustService'));
const svcPath = require.resolve(path.join('..', 'services/production-lot/lotAllocationAdjustService'));
require.cache[svcPath].exports = {
    ...realSvc,
    adjustAllocationQty: async (...a) => { adjustCalls.push(['adjust', ...a]); return adjustImpl(...a); }
};
const { updateAllocationQty } = require(path.join('..', 'controllers/production-lot/allocation/lotAllocationQtyController'));
const { BusinessError } = require('../helpers/businessError');

const makeRes = () => {
    const res = { code: 200, body: null };
    res.status = (c) => { res.code = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};
const makeReq = (body, over = {}) => ({ params: { allocationId: '9' }, body, user: { id: 4 }, ...over });

test.beforeEach(() => {
    events = []; adjustCalls.length = 0; getConnectionCalls = 0; actorExists = true; lockAcquired = 1;
    adjustImpl = async () => ({ allocationId: 9, oldAllocatedQty: 1000, newAllocatedQty: 2500, status: 'Open' });
});

const originalError = console.error;
test.before(() => { console.error = () => {}; });
test.after(() => { console.error = originalError; });

// ---------- ubah qty ----------

test('qty: sukses; pelaku dari token (userId body diabaikan); pesan berformat ribuan gaya Indonesia', async () => {
    const res = makeRes();
    await updateAllocationQty(makeReq({ newAllocatedQty: 2500, reason: ' Koreksi ', userId: 999 }), res);

    assert.equal(res.code, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Allocated quantity successfully updated from 1.000 to 2.500.');
    assert.deepEqual(res.body.data, { allocationId: 9, oldAllocatedQty: 1000, newAllocatedQty: 2500, status: 'Open' });

    assert.equal(adjustCalls.length, 1);
    assert.deepEqual(adjustCalls[0].slice(2), [{ allocationId: 9, newQty: 2500, reason: 'Koreksi', userId: 4 }]);
    assert.equal(adjustCalls[0][1], connection);
    const kinds = events.map((e) => e[0]);
    assert.deepEqual(kinds.filter((k) => k !== 'query'), ['begin', 'commit', 'release']);
});

test('qty: input tidak valid ditolak 400 sebelum koneksi/lock apa pun', async () => {
    const cases = [
        [makeReq({ newAllocatedQty: 'x', reason: 'a' })],
        [makeReq({ newAllocatedQty: 5 })],
        [makeReq({ newAllocatedQty: 5, reason: 'a'.repeat(51) })],
        [makeReq({ newAllocatedQty: -1, reason: 'a' })],
        [makeReq({ newAllocatedQty: 5, reason: 'a' }, { params: { allocationId: 'abc' } })],
        [makeReq({ newAllocatedQty: 5, reason: 'a' }, { user: undefined })],
        [makeReq(undefined)]
    ];
    for (const [req] of cases) {
        const res = makeRes();
        await updateAllocationQty(req, res);
        assert.equal(res.code, 400, JSON.stringify(req.body));
        assert.equal(res.body.success, false);
    }
    assert.equal(getConnectionCalls, 0);
    assert.equal(adjustCalls.length, 0);
});

test('qty: pelaku tidak ada di tabel employees -> 400, rollback, layanan tidak dipanggil', async () => {
    actorExists = false;
    const res = makeRes();
    await updateAllocationQty(makeReq({ newAllocatedQty: 5, reason: 'a' }), res);
    assert.equal(res.code, 400);
    assert.match(res.body.message, /User not found/);
    assert.equal(adjustCalls.length, 0);
    assert.ok(events.some((e) => e[0] === 'rollback'));
    assert.ok(events.some((e) => e[0] === 'query' && /RELEASE_LOCK/.test(e[1])));
});

test('qty: lock sibuk -> 409 tanpa transaksi', async () => {
    lockAcquired = 0;
    const res = makeRes();
    await updateAllocationQty(makeReq({ newAllocatedQty: 5, reason: 'a' }), res);
    assert.equal(res.code, 409);
    assert.equal(adjustCalls.length, 0);
    assert.ok(!events.some((e) => e[0] === 'begin'));
    assert.ok(events.some((e) => e[0] === 'release'));
});

test('qty: error bisnis dari layanan diteruskan dengan status-nya dan di-rollback; error sistem jadi 500 generik', async () => {
    adjustImpl = async () => { throw new BusinessError('Exceeds', 400); };
    let res = makeRes();
    await updateAllocationQty(makeReq({ newAllocatedQty: 5, reason: 'a' }), res);
    assert.equal(res.code, 400);
    assert.equal(res.body.message, 'Exceeds');
    assert.ok(events.some((e) => e[0] === 'rollback'));

    events = [];
    adjustImpl = async () => { throw new Error('SELECT secret FROM x'); };
    res = makeRes();
    await updateAllocationQty(makeReq({ newAllocatedQty: 5, reason: 'a' }), res);
    assert.equal(res.code, 500);
    assert.equal(res.body.message, 'Internal server error while updating allocated quantity.');
    assert.ok(!/secret/.test(JSON.stringify(res.body)));
});
