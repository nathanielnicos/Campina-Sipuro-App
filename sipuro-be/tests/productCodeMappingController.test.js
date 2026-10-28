'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

let events = [];
let lockAcquired = 1;
let actorExists = true;
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
const fakeDb = { getConnection: async () => { getConnectionCalls += 1; return connection; }, query: async () => [[]] };

const calls = [];
let createImpl;
let deleteImpl;
let listImpl;

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    return originalLoad.apply(this, arguments);
};
const realSvc = require(path.join('..', 'services/product-code-mapping/productCodeMappingService'));
const svcPath = require.resolve(path.join('..', 'services/product-code-mapping/productCodeMappingService'));
require.cache[svcPath].exports = {
    ...realSvc,
    createMapping: async (...a) => { calls.push(['create', ...a]); return createImpl(...a); },
    deleteMapping: async (...a) => { calls.push(['delete', ...a]); return deleteImpl(...a); },
    listMappings: async (...a) => { calls.push(['list', ...a]); return listImpl(...a); }
};
const { listProductCodeMappings } = require(path.join('..', 'controllers/product-code-mapping/productCodeMappingListController'));
const { createProductCodeMapping } = require(path.join('..', 'controllers/product-code-mapping/productCodeMappingCreateController'));
const { deleteProductCodeMapping } = require(path.join('..', 'controllers/product-code-mapping/productCodeMappingDeleteController'));
const { BusinessError } = require('../helpers/businessError');

const makeRes = () => {
    const res = { code: 200, body: null };
    res.status = (c) => { res.code = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};

test.beforeEach(() => {
    events = []; calls.length = 0; lockAcquired = 1; actorExists = true; getConnectionCalls = 0;
    createImpl = async () => ({ id: 55, id_product_old: 1, id_product_new: 2 });
    deleteImpl = async () => ({ id: 7 });
    listImpl = async () => ({ data: [{ id: 1 }], pagination: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 } });
});
const originalError = console.error;
test.before(() => { console.error = () => {}; });
test.after(() => { console.error = originalError; });

const reqOf = (over = {}) => ({ params: {}, query: {}, body: { idProductOld: 1, idProductNew: 2, userId: 999 }, user: { id: 4 }, ...over });

// ---------- tambah ----------

test('tambah: sukses 201; pelaku dari token (userId body diabaikan); transaksi di-commit', async () => {
    const res = makeRes();
    await createProductCodeMapping(reqOf(), res);
    assert.equal(res.code, 201);
    assert.deepEqual(res.body, { success: true, message: 'Product code mapping successfully created.', data: { id: 55, id_product_old: 1, id_product_new: 2 } });
    assert.deepEqual(calls[0].slice(2), [{ idProductOld: 1, idProductNew: 2, userId: 4 }]);
    assert.equal(calls[0][1], connection);
    assert.deepEqual(events.map((e) => e[0]).filter((k) => k !== 'query'), ['begin', 'commit', 'release']);
});

test('tambah: id salah / hilang / tanpa token -> 400 tanpa koneksi', async () => {
    const bad = [
        reqOf({ body: { idProductOld: 'x', idProductNew: 2 } }),
        reqOf({ body: { idProductOld: 1 } }),
        reqOf({ body: { idProductOld: 0, idProductNew: 2 } }),
        reqOf({ body: undefined }),
        reqOf({ user: undefined })
    ];
    for (const req of bad) {
        const res = makeRes();
        await createProductCodeMapping(req, res);
        assert.equal(res.code, 400, JSON.stringify(req.body));
    }
    assert.equal(getConnectionCalls, 0);
    assert.equal(calls.length, 0);
});

test('tambah: pelaku tidak ada -> 400 rollback; lock sibuk -> 409; error bisnis diteruskan; sistem -> 500 generik', async () => {
    actorExists = false;
    let res = makeRes();
    await createProductCodeMapping(reqOf(), res);
    assert.equal(res.code, 400);
    assert.equal(calls.length, 0);
    assert.ok(events.some((e) => e[0] === 'rollback'));

    actorExists = true; lockAcquired = 0; events = [];
    res = makeRes();
    await createProductCodeMapping(reqOf(), res);
    assert.equal(res.code, 409);
    assert.ok(!events.some((e) => e[0] === 'begin'));

    lockAcquired = 1; events = [];
    createImpl = async () => { throw new BusinessError('already linked', 409); };
    res = makeRes();
    await createProductCodeMapping(reqOf(), res);
    assert.equal(res.code, 409);
    assert.equal(res.body.message, 'already linked');
    assert.ok(events.some((e) => e[0] === 'rollback'));

    createImpl = async () => { throw new Error('SELECT secret'); };
    res = makeRes();
    await createProductCodeMapping(reqOf(), res);
    assert.equal(res.code, 500);
    assert.equal(res.body.message, 'Internal server error while creating product code mapping.');
    assert.ok(!/secret/.test(JSON.stringify(res.body)));
});

// ---------- hapus ----------

test('hapus: sukses; id salah -> 400 tanpa koneksi; tidak ada -> 404 dengan rollback', async () => {
    let res = makeRes();
    await deleteProductCodeMapping(reqOf({ params: { mappingId: '7' } }), res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { success: true, message: 'Product code mapping successfully deleted.' });
    assert.deepEqual(calls[0].slice(2), [{ mappingId: 7, userId: 4 }]);

    calls.length = 0; getConnectionCalls = 0;
    for (const req of [reqOf({ params: { mappingId: 'abc' } }), reqOf({ params: {} }), reqOf({ params: { mappingId: '1' }, user: {} })]) {
        res = makeRes();
        await deleteProductCodeMapping(req, res);
        assert.equal(res.code, 400);
    }
    assert.equal(getConnectionCalls, 0);

    events = [];
    deleteImpl = async () => { throw new BusinessError('not found', 404); };
    res = makeRes();
    await deleteProductCodeMapping(reqOf({ params: { mappingId: '7' } }), res);
    assert.equal(res.code, 404);
    assert.ok(events.some((e) => e[0] === 'rollback'));
});

// ---------- daftar ----------

test('daftar: halaman dan pencarian dibaca dari query; batas limit 100; hasil diteruskan', async () => {
    let res = makeRes();
    await listProductCodeMappings(reqOf({ query: { page: '3', limit: '500', search: '  FG-1 ' } }), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, [{ id: 1 }]);
    assert.deepEqual(calls[0].slice(2), [{ search: 'FG-1', page: 3, limit: 100, offset: 200 }]);

    calls.length = 0;
    await listProductCodeMappings(reqOf({ query: {} }), makeRes());
    assert.deepEqual(calls[0][2], { search: '', page: 1, limit: 10, offset: 0 });

    listImpl = async () => { throw new Error('db down'); };
    res = makeRes();
    await listProductCodeMappings(reqOf(), res);
    assert.equal(res.code, 500);
    assert.equal(res.body.message, 'Internal server error while fetching product code mappings.');
});
