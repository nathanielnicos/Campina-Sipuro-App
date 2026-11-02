'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

let queryImpl = async () => [[{ group_code: 'LOGISTIC', menu_code: 'DO', action: 'upload' }]];
const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/helpers/tokenHelper')) return { verifyToken: () => ({}) };
    if (request.endsWith('/config/db')) return { sipuroDb: { query: (...a) => queryImpl(...a) } };
    return originalLoad.apply(this, arguments);
};
const { requirePermission } = require('../middleware/requirePermission');
const { invalidatePermissionCache } = require('../services/access-permission/permissionStore');

const run = async (guard, user) => {
    const res = { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    let nexted = false;
    await guard({ user }, res, () => { nexted = true; });
    return { res, nexted };
};
const logistic = { type: 'EMPLOYEE', role: 'STAFF', department: 'LOGISTIC' };

test.beforeEach(() => invalidatePermissionCache());

test('menu atau aksi tidak dikenal gagal saat route didaftarkan', () => {
    assert.throws(() => requirePermission('NOPE', 'read'), /unknown menu/);
    assert.throws(() => requirePermission('DO', 'approve'), /unknown menu/);
});

test('tanpa user: 401; diizinkan: next; tidak diizinkan: 403', async () => {
    const guard = requirePermission('DO', 'upload');
    const a = await run(guard, undefined);
    assert.equal(a.res.code, 401);
    assert.equal(a.nexted, false);

    const b = await run(guard, logistic);
    assert.equal(b.nexted, true);

    invalidatePermissionCache();
    const c = await run(guard, { type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' });
    assert.equal(c.res.code, 403);
    assert.equal(c.nexted, false);
});

test('kegagalan database: 500 tanpa membuka akses', async () => {
    queryImpl = async () => { throw new Error('db down'); };
    const origError = console.error; console.error = () => {};
    const r = await run(requirePermission('DO', 'upload'), logistic);
    console.error = origError;
    assert.equal(r.res.code, 500);
    assert.equal(r.nexted, false);
});
