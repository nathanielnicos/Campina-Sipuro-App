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
const svc = require('../services/access-permission/accessPermissionService');
const { defaultGrants } = require('../services/access-permission/permissionDefaults');

const rejects400 = (fn, re) => assert.throws(fn, (e) => e.status === 400 && re.test(e.message));
const ok = { group: 'PPIC', menu: 'DO', action: 'read', allowed: true };

test('parseChanges: input valid dibentuk ulang tanpa field lain', () => {
    const out = svc.parseChanges({ changes: [{ ...ok, extra: 'x' }] });
    assert.deepEqual(out, [ok]);
});

test('parseChanges: penolakan', () => {
    rejects400(() => svc.parseChanges(undefined), /At least one/);
    rejects400(() => svc.parseChanges({ changes: [] }), /At least one/);
    rejects400(() => svc.parseChanges({ changes: 'x' }), /At least one/);
    rejects400(() => svc.parseChanges({ changes: Array(svc.MAX_CHANGES + 1).fill(ok) }), /At most/);
    rejects400(() => svc.parseChanges({ changes: [{ ...ok, group: 'HR' }] }), /unknown user group/);
    rejects400(() => svc.parseChanges({ changes: [{ ...ok, menu: 'NOPE' }] }), /unknown menu or action/);
    rejects400(() => svc.parseChanges({ changes: [{ ...ok, action: 'approve' }] }), /unknown menu or action/);
    rejects400(() => svc.parseChanges({ changes: [{ ...ok, allowed: 'true' }] }), /true or false/);
    rejects400(() => svc.parseChanges({ changes: [ok, ok] }), /more than once/);
    rejects400(() => svc.parseChanges({ changes: [null] }), /unknown user group/);
});

test('parseChanges: akses Superadmin ke pengaturan izin tidak bisa dimatikan, tapi boleh dinyalakan', () => {
    const cell = { group: 'SUPERADMIN', menu: 'ACCESS_PERMISSIONS', action: 'update' };
    rejects400(() => svc.parseChanges({ changes: [{ ...cell, allowed: false }] }), /cannot be removed/);
    assert.equal(svc.parseChanges({ changes: [{ ...cell, allowed: true }] }).length, 1);
    // kelompok lain pada menu yang sama boleh diatur
    assert.equal(svc.parseChanges({ changes: [{ ...cell, group: 'PPIC', allowed: true }] }).length, 1);
});

const makeConn = (existing) => {
    const calls = [];
    return {
        calls,
        query: async (sql, params) => {
            calls.push({ sql, params });
            if (/^\s*SELECT/.test(sql)) return [existing];
            return [{}];
        }
    };
};
const find = (c, re) => c.calls.filter((x) => re.test(x.sql));

test('applyChanges: hanya sel yang benar-benar berubah ditulis dan dicatat', async () => {
    const conn = makeConn([
        { group_code: 'PPIC', menu_code: 'DO', action: 'read', is_allowed: 1 },
        { group_code: 'PPIC', menu_code: 'DO', action: 'upload', is_allowed: 0 }
    ]);
    const out = await svc.applyChanges(conn, {
        userId: 7,
        changes: [
            { group: 'PPIC', menu: 'DO', action: 'read', allowed: true },      // sama: dilewati
            { group: 'PPIC', menu: 'DO', action: 'upload', allowed: true },    // 0 -> 1
            { group: 'FINANCE', menu: 'SI', action: 'read', allowed: false }   // tidak ada baris = 0 -> 0: dilewati
        ]
    });
    assert.equal(out.changedCount, 1);
    assert.deepEqual(find(conn, /^INSERT INTO access_permissions /)[0].params, [[['PPIC', 'DO', 'upload', 1, 7]]]);
    assert.deepEqual(find(conn, /access_permission_logs/)[0].params, [[['PPIC', 'DO', 'upload', 0, 1, 7]]]);
    assert.match(find(conn, /^\s*SELECT/)[0].sql, /FOR UPDATE/);
});

test('applyChanges: sel tanpa baris yang dinyalakan dicatat sebagai 0 -> 1; tanpa perubahan tidak menulis', async () => {
    const conn = makeConn([]);
    const out = await svc.applyChanges(conn, { userId: 7, changes: [{ group: 'FINANCE', menu: 'DO', action: 'upload', allowed: true }] });
    assert.equal(out.changedCount, 1);
    assert.deepEqual(find(conn, /access_permission_logs/)[0].params[0][0], ['FINANCE', 'DO', 'upload', 0, 1, 7]);

    const none = makeConn([{ group_code: 'PPIC', menu_code: 'DO', action: 'read', is_allowed: 1 }]);
    const r = await svc.applyChanges(none, { userId: 7, changes: [{ group: 'PPIC', menu: 'DO', action: 'read', allowed: true }] });
    assert.equal(r.changedCount, 0);
    assert.equal(find(none, /^INSERT/).length, 0);
});

test('loadMatrixView: matriks per kelompok, katalog menu, dan sel terkunci', async () => {
    const db = { query: async () => [defaultGrants().map(([group_code, menu_code, action]) => ({ group_code, menu_code, action }))] };
    const view = await svc.loadMatrixView(db);
    assert.deepEqual(view.matrix.LOGISTIC, { DO: ['read', 'upload', 'export'] });
    assert.deepEqual(view.matrix.CUSTOMER.PO, ['read', 'create', 'update', 'export']);
    assert.equal(view.matrix.PPIC.ACCESS_PERMISSIONS, undefined);
    assert.deepEqual(view.locked, [{ group: 'SUPERADMIN', menu: 'ACCESS_PERMISSIONS' }]);
    assert.ok(view.menus.find((m) => m.code === 'DO' && m.actions.join() === 'read,upload,export'));
    assert.equal(view.groups.length, 5);
});

test('loadMatrixView: tabel kosong tetap memberi Superadmin menu pengaturan izin', async () => {
    const view = await svc.loadMatrixView({ query: async () => [[]] });
    assert.deepEqual(view.matrix.SUPERADMIN, { ACCESS_PERMISSIONS: ['read', 'update'] });
    assert.deepEqual(view.matrix.PPIC, {});
});

test('listLogs: bentuk data dan halaman', async () => {
    const db = {
        query: async (sql) => /COUNT/.test(sql)
            ? [[{ total: 45 }]]
            : [[{ id: 3, group_code: 'PPIC', menu_code: 'DO', action: 'upload', old_allowed: 0, new_allowed: 1, changed_at: '2026-11-02 10:00:00', changed_by_name: 'Admin' }]]
    };
    const out = await svc.listLogs(db, { page: 2, limit: 20, offset: 20 });
    assert.deepEqual(out.data[0], { id: 3, group: 'PPIC', menu: 'DO', action: 'upload', oldAllowed: false, newAllowed: true, changedAt: '2026-11-02 10:00:00', changedBy: 'Admin' });
    assert.deepEqual(out.pagination, { page: 2, limit: 20, totalItems: 45, totalPages: 3 });
});
