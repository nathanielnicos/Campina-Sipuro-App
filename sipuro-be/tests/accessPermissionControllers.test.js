'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const queries = [];
let failTx = false;
const conn = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    query: async (sql, params) => {
        queries.push({ sql, params });
        if (/GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
        if (/FROM employees/.test(sql)) return [[{ id: 1 }]];
        if (/FOR UPDATE/.test(sql)) return [[]];
        if (/FROM access_permissions/.test(sql)) return [[{ group_code: 'LOGISTIC', menu_code: 'DO', action: 'upload' }]];
        if (failTx) throw new Error('boom');
        return [{}];
    }
};
const db = { getConnection: async () => conn, query: (...a) => conn.query(...a) };

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/helpers/tokenHelper')) return { verifyToken: () => ({}) };
    if (request === 'express') {
        // Router tiruan: mencatat route beserta handler-nya (express tidak dipasang di lingkungan uji)
        const Router = () => {
            const router = { stack: [] };
            ['get', 'put'].forEach((method) => {
                router[method] = (path, ...handlers) => router.stack.push({ route: { path, methods: { [method]: true }, stack: handlers } });
            });
            return router;
        };
        return { Router };
    }
    if (request.endsWith('/config/db')) return { sipuroDb: db };
    return originalLoad.apply(this, arguments);
};
const { updateAccessPermissions } = require('../controllers/access-permission/accessPermissionUpdateController');
const { getMyPermissions } = require('../controllers/access-permission/myPermissionsController');
const store = require('../services/access-permission/permissionStore');

const makeRes = () => ({ code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const admin = { id: 1, type: 'EMPLOYEE', role: 'SUPERADMIN', department: null };

test.beforeEach(() => { queries.length = 0; failTx = false; store.invalidatePermissionCache(); });

test('simpan: 200 dengan matriks terbaru; pelaku dari token', async () => {
    const res = makeRes();
    await updateAccessPermissions({ user: admin, body: { userId: 99, changes: [{ group: 'LOGISTIC', menu: 'DO', action: 'upload', allowed: true }] } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.changedCount, 1);
    assert.deepEqual(res.body.data.matrix.LOGISTIC, { DO: ['upload'] });
    const insert = queries.find((q) => /^INSERT INTO access_permissions /.test(q.sql));
    assert.deepEqual(insert.params[0][0], ['LOGISTIC', 'DO', 'upload', 1, 1]); // updated_by = 1 (token), bukan 99
});

test('simpan: input salah 400 tanpa menyentuh database', async () => {
    const res = makeRes();
    await updateAccessPermissions({ user: admin, body: { changes: [] } }, res);
    assert.equal(res.code, 400);
    assert.equal(queries.length, 0);
});

test('simpan: kegagalan database 500 generik', async () => {
    failTx = true;
    const origError = console.error; console.error = () => {};
    const res = makeRes();
    await updateAccessPermissions({ user: admin, body: { changes: [{ group: 'LOGISTIC', menu: 'DO', action: 'upload', allowed: true }] } }, res);
    console.error = origError;
    assert.equal(res.code, 500);
    assert.match(res.body.message, /Internal server error/);
});

test('izin saya: kelompok dan menu/aksi pengguna login', async () => {
    const res = makeRes();
    await getMyPermissions({ user: { type: 'EMPLOYEE', role: 'STAFF', department: 'LOGISTIC' } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.data, { group: 'LOGISTIC', permissions: { DO: ['upload'] } });
});

test('route: setiap endpoint pengaturan izin dipasang guard sebelum controller', () => {
    const router = require('../routes/accessPermissionRoutes');
    const layers = router.stack.filter((l) => l.route);
    assert.deepEqual(layers.map((l) => `${Object.keys(l.route.methods)[0]} ${l.route.path}`), ['get /', 'put /', 'get /logs']);
    layers.forEach((l) => assert.equal(l.route.stack.length, 2, 'guard + controller'));
});
