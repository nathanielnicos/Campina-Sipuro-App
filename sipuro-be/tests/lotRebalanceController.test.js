'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

let events = [];
let lockAcquired = 1;
const connection = {
    query: async (sql, params) => {
        events.push(['query', sql.replace(/\s+/g, ' ').trim()]);
        if (/GET_LOCK/.test(sql)) return [[{ acquired: lockAcquired }]];
        if (/FROM employees/.test(sql)) return [[{ id: params[0] }]];
        return [[]];
    },
    beginTransaction: async () => events.push(['begin']),
    commit: async () => events.push(['commit']),
    rollback: async () => events.push(['rollback']),
    release: () => events.push(['release'])
};
const fakeDb = { getConnection: async () => connection };

const calls = [];
const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    return originalLoad.apply(this, arguments);
};
const svcPath = require.resolve(path.join('..', 'services/production-lot/lotRebalanceService'));
const realSvc = require(svcPath);
require.cache[svcPath].exports = {
    ...realSvc,
    listRebalanceProducts: async () => [{ id_product: 1, product_code: 'P1', product_name: 'Produk 1' }],
    previewRebalance: async (db, args) => { calls.push(['preview', args]); return { canApply: true, fingerprint: 'f' }; },
    commitRebalance: async (conn, args) => { calls.push(['commit', args]); return { changedAllocationCount: 3, reversedManualEditCount: 0, poItemStatusChangeCount: 1 }; }
};
const { listAllocationRebalanceProducts, previewAllocationRebalance, commitAllocationRebalance } = require(path.join('..', 'controllers/production-lot/allocation/lotRebalanceController'));

const makeRes = () => {
    const res = { code: 200, body: null };
    res.status = (c) => { res.code = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};
const FP = 'a'.repeat(64);

test('pratinjau: memakai sipuroDb tanpa transaksi', async () => {
    events = []; calls.length = 0;
    const res = makeRes();
    await previewAllocationRebalance({ body: { productId: 3 }, user: { id: 1 } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(calls[0], ['preview', { productId: 3 }]);
    assert.ok(!events.some((e) => e[0] === 'begin'));
});

test('pratinjau: productId tidak valid -> 400', async () => {
    const res = makeRes();
    await previewAllocationRebalance({ body: { productId: 'x' }, user: { id: 1 } }, res);
    assert.equal(res.code, 400);
});

test('commit: berjalan di transaksi ber-lock dengan pelaku dari token', async () => {
    events = []; calls.length = 0; lockAcquired = 1;
    const res = makeRes();
    await commitAllocationRebalance({ body: { productId: 3, fingerprint: FP, reason: 'fix hole', userId: 999 }, user: { id: 7 } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(calls[0], ['commit', { productId: 3, fingerprint: FP, reason: 'fix hole', userId: 7 }]);
    const kinds = events.map((e) => e[0]);
    assert.ok(kinds.indexOf('begin') < kinds.indexOf('commit'));
    assert.ok(kinds.includes('release'));
});

test('commit: alasan kosong, terlalu panjang, atau sidik jari tidak valid -> 400 tanpa transaksi', async () => {
    for (const body of [
        { productId: 3, fingerprint: FP, reason: '  ' },
        { productId: 3, fingerprint: FP, reason: 'x'.repeat(51) },
        { productId: 3, fingerprint: 'zzz', reason: 'ok' }
    ]) {
        events = []; calls.length = 0;
        const res = makeRes();
        await commitAllocationRebalance({ body, user: { id: 7 } }, res);
        assert.equal(res.code, 400);
        assert.equal(calls.length, 0);
        assert.ok(!events.some((e) => e[0] === 'begin'));
    }
});

test('commit: lock sibuk -> 409', async () => {
    events = []; calls.length = 0; lockAcquired = 0;
    const res = makeRes();
    await commitAllocationRebalance({ body: { productId: 3, fingerprint: FP, reason: 'ok' }, user: { id: 7 } }, res);
    assert.equal(res.code, 409);
    assert.equal(calls.length, 0);
    lockAcquired = 1;
});

test('daftar produk: dibaca tanpa transaksi', async () => {
    events = [];
    const res = makeRes();
    await listAllocationRebalanceProducts({ user: { id: 1 } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.data, [{ id_product: 1, product_code: 'P1', product_name: 'Produk 1' }]);
    assert.ok(!events.some((e) => e[0] === 'begin'));
});
