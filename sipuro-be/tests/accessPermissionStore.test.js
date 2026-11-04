'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/helpers/tokenHelper')) return { verifyToken: () => ({}) };
    if (request.endsWith('/config/db')) return { sipuroDb: null };
    return originalLoad.apply(this, arguments);
};
const store = require('../services/access-permission/permissionStore');
const { defaultGrants } = require('../services/access-permission/permissionDefaults');

const makeDb = (grants = defaultGrants()) => {
    const db = { calls: 0 };
    db.query = async () => {
        db.calls += 1;
        return [grants.map(([group_code, menu_code, action]) => ({ group_code, menu_code, action }))];
    };
    return db;
};

const emp = (role, department) => ({ type: 'EMPLOYEE', role, department });
const customer = { type: 'CUSTOMER', role: 'CUSTOMER', department: null };

test.beforeEach(() => store.invalidatePermissionCache());

test('groupOf: kelompok dari tipe/peran/departemen', () => {
    assert.equal(store.groupOf(customer), 'CUSTOMER');
    assert.equal(store.groupOf(emp('SUPERADMIN', null)), 'SUPERADMIN');
    assert.equal(store.groupOf(emp('STAFF', 'ppic')), 'PPIC');
    assert.equal(store.groupOf(emp('MANAGER', 'LOGISTICS')), 'LOGISTIC');
    assert.equal(store.groupOf(emp('STAFF', 'FINANCE')), 'FINANCE');
    assert.equal(store.groupOf(emp('STAFF', 'HR')), null);
    assert.equal(store.groupOf(null), null);
});

test('izin awal: DO read untuk PPIC/LOGISTIC/FINANCE, upload hanya LOGISTIC', async () => {
    const db = makeDb();
    const can = (u, m, a) => store.isAllowed(db, u, m, a);
    assert.equal(await can(emp('STAFF', 'PPIC'), 'DO', 'read'), true);
    assert.equal(await can(emp('STAFF', 'FINANCE'), 'DO', 'read'), true);
    assert.equal(await can(emp('STAFF', 'LOGISTIC'), 'DO', 'upload'), true);
    assert.equal(await can(emp('STAFF', 'PPIC'), 'DO', 'upload'), false);
    assert.equal(await can(emp('SUPERADMIN', null), 'DO', 'read'), false);
    assert.equal(await can(customer, 'DO', 'read'), false);
    assert.equal(await can(emp('STAFF', 'HR'), 'DO', 'read'), false);
});

test('menu pengaturan izin: SUPERADMIN selalu diizinkan, kelompok lain tidak', async () => {
    const db = makeDb([]); // tabel kosong
    assert.equal(await store.isAllowed(db, emp('SUPERADMIN', null), 'ACCESS_PERMISSIONS', 'update'), true);
    assert.equal(await store.isAllowed(db, emp('SUPERADMIN', null), 'DO', 'read'), false);
    assert.equal(await store.isAllowed(db, emp('STAFF', 'PPIC'), 'ACCESS_PERMISSIONS', 'read'), false);
});

test('cache: satu query dalam masa berlaku; invalidate memuat ulang', async () => {
    const db = makeDb();
    await store.isAllowed(db, customer, 'PO', 'read');
    await store.isAllowed(db, customer, 'PO', 'create');
    assert.equal(db.calls, 1);
    store.invalidatePermissionCache();
    await store.isAllowed(db, customer, 'PO', 'read');
    assert.equal(db.calls, 2);
});

test('permissionsOf: hanya menu dan aksi yang diizinkan', async () => {
    const db = makeDb();
    assert.deepEqual(await store.permissionsOf(db, emp('STAFF', 'LOGISTIC')), { DO: ['read', 'upload', 'export'] });
    assert.deepEqual(await store.permissionsOf(db, emp('STAFF', 'HR')), {});
    const sa = await store.permissionsOf(db, emp('SUPERADMIN', null));
    assert.deepEqual(sa.ACCESS_PERMISSIONS, ['read', 'update']);
    assert.equal(sa.DO, undefined);
});
