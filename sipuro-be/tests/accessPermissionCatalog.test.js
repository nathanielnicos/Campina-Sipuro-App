'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GROUPS, ACTIONS, MENUS, isValidMenuAction, isLockedCell } = require('../services/access-permission/permissionCatalog');
const { DEFAULT_PERMISSIONS, defaultGrants } = require('../services/access-permission/permissionDefaults');

test('katalog: aksi tiap menu valid dan tidak ada aksi hapus', () => {
    Object.entries(MENUS).forEach(([menu, def]) => {
        assert.ok(def.label, menu);
        assert.ok(def.actions.length > 0, menu);
        def.actions.forEach((a) => assert.ok(ACTIONS.includes(a), `${menu}.${a}`));
    });
    assert.ok(!ACTIONS.includes('delete'));
});

test('seed awal: setiap sel memakai menu, aksi, dan kelompok yang ada di katalog', () => {
    assert.deepEqual(Object.keys(DEFAULT_PERMISSIONS).sort(), Object.keys(MENUS).sort());
    defaultGrants().forEach(([group, menu, action]) => {
        assert.ok(GROUPS.includes(group), group);
        assert.ok(isValidMenuAction(menu, action), `${menu}.${action}`);
    });
});

test('seed awal: SUPERADMIN penuh pada menu pengaturan izin; DO hanya LOGISTIC yang upload', () => {
    assert.deepEqual(DEFAULT_PERMISSIONS.ACCESS_PERMISSIONS.update, ['SUPERADMIN']);
    assert.deepEqual(DEFAULT_PERMISSIONS.DO.upload, ['LOGISTIC']);
    assert.ok(!DEFAULT_PERMISSIONS.DO.read.includes('SUPERADMIN'));
    assert.ok(isLockedCell('SUPERADMIN', 'ACCESS_PERMISSIONS'));
    assert.ok(!isLockedCell('PPIC', 'ACCESS_PERMISSIONS'));
});

test('seed awal: tidak ada sel ganda', () => {
    const keys = defaultGrants().map((g) => g.join('|'));
    assert.equal(new Set(keys).size, keys.length);
});
