'use strict';

/**
 * Pemeriksaan statis route: setiap endpoint di router yang dikelola matriks izin wajib dijaga requirePermission
 * (sebelum middleware upload), tanpa sisa requireAccess, dan semua pasangan menu/aksi ada di katalog.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { isValidMenuAction } = require('../services/access-permission/permissionCatalog');

const GUARDED = [
    'dashboardRoutes', 'doRoutes', 'masterUploadRoutes', 'outstandingPoRoutes', 'poRoutes', 'productCodeMappingRoutes',
    'productionLotRoutes', 'productionScheduleRoutes', 'siRoutes', 'superadminRoutes', 'accessPermissionRoutes'
];

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'routes', `${name}.js`), 'utf8');

test('router terkelola tidak memakai requireAccess lagi', () => {
    GUARDED.forEach((name) => assert.ok(!/requireAccess/.test(read(name)), name));
});

test('semua pasangan menu/aksi yang dipakai ada di katalog', () => {
    GUARDED.forEach((name) => {
        const pairs = [...read(name).matchAll(/requirePermission\('(\w+)', '(\w+)'\)/g)];
        assert.ok(pairs.length > 0, name);
        pairs.forEach(([, menu, action]) => assert.ok(isValidMenuAction(menu, action), `${name}: ${menu}.${action}`));
    });
});

test('setiap endpoint punya guard izin, dipasang sebelum middleware upload', () => {
    GUARDED.forEach((name) => {
        const src = read(name);
        // variabel guard: const x = requirePermission(...)
        const guardVars = [...src.matchAll(/^const (\w+) = requirePermission\(/gm)].map((m) => m[1]);
        const lines = src.split('\n').filter((l) => /^router\.(get|post|put|patch|delete)\(/.test(l));
        assert.ok(lines.length > 0, name);
        lines.forEach((line) => {
            const guardAt = Math.min(
                ...[line.indexOf('requirePermission('), ...guardVars.map((v) => line.search(new RegExp(`\\b${v}\\b`)))].filter((i) => i >= 0),
                Infinity
            );
            assert.ok(Number.isFinite(guardAt), `${name}: tanpa guard -> ${line.trim()}`);
            ['handleExcelUpload', 'upload.single'].forEach((mw) => {
                const at = line.indexOf(mw);
                if (at >= 0) assert.ok(guardAt < at, `${name}: guard harus sebelum ${mw}`);
            });
        });
        assert.ok(!/router\.delete\(/.test(src), `${name}: tidak ada route hapus`);
    });
});
