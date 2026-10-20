'use strict';

/**
 * Tes pembatasan akses rute Batch (routes/batchRoutes.js).
 * Express diganti tiruan sederhana yang hanya mencatat rute, dan middleware auth yang asli
 * dipakai untuk menilai peran. Tidak menyentuh database.
 * Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const routes = [];
const router = {};
['get', 'post', 'patch'].forEach((method) => {
    router[method] = (routePath, ...handlers) => routes.push({ method: method.toUpperCase(), path: routePath, handlers });
});
const fakeExpress = () => ({});
fakeExpress.Router = () => router;

const controllerFns = {};
const controllerStub = new Proxy({}, {
    get: (_target, name) => {
        if (!controllerFns[name]) controllerFns[name] = function controller() {};
        return controllerFns[name];
    }
});
const uploadMarker = function uploadMarker() {};

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request === 'express') return fakeExpress;
    if (request.endsWith('/config/db')) return { sipuroDb: null };
    if (request.endsWith('/helpers/tokenHelper')) return { verifyToken() { throw new Error('tidak dipakai di tes'); } };
    if (request.endsWith('/controllers/batch/batchController')) return controllerStub;
    if (request.endsWith('/middleware/excelUpload')) return { handleExcelUpload: uploadMarker };
    return originalLoad.apply(this, arguments);
};

require('../routes/batchRoutes');

const USERS = {
    customer: { type: 'CUSTOMER', role: 'CUSTOMER', department: null, customerId: 5 },
    ppic: { type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' },
    ppicManager: { type: 'EMPLOYEE', role: 'MANAGER', department: 'PPIC' },
    superadmin: { type: 'EMPLOYEE', role: 'SUPERADMIN', department: null },
    logistic: { type: 'EMPLOYEE', role: 'STAFF', department: 'LOGISTIC' },
    finance: { type: 'EMPLOYEE', role: 'STAFF', department: 'FINANCE' },
    anonymous: undefined
};

const OUTSTANDING = ['customer', 'ppic', 'ppicManager', 'superadmin'];
const PPIC_ONLY = ['ppic', 'ppicManager'];

const POLICY = {
    'GET /export-batch-excel': PPIC_ONLY,
    'GET /outstanding-summary': OUTSTANDING,
    'GET /batch-mapping': PPIC_ONLY,
    'GET /allocation-logs/:allocationId': PPIC_ONLY,
    'POST /production/preview': PPIC_ONLY,
    'POST /production/commit': PPIC_ONLY,
    'PATCH /allocation/:allocationId/status': PPIC_ONLY,
    'PATCH /allocation/:allocationId/qty': PPIC_ONLY
};

const runAccess = (handler, user) => {
    const req = { user };
    const out = { statusCode: null, nextCalled: false };
    const res = {
        status(code) { out.statusCode = code; return res; },
        json() { return res; }
    };
    handler(req, res, () => { out.nextCalled = true; });
    return out;
};

test('daftar rute sama persis dengan kebijakan akses (rute baru wajib diberi kebijakan)', () => {
    const registered = routes.map((r) => `${r.method} ${r.path}`).sort();
    assert.deepEqual(registered, Object.keys(POLICY).sort());
});

test('setiap rute punya middleware akses sebelum controller', () => {
    for (const route of routes) {
        const controllerFnsList = Object.values(controllerFns);
        assert.ok(route.handlers.length >= 2, `${route.method} ${route.path} tanpa middleware`);
        assert.ok(!controllerFnsList.includes(route.handlers[0]), `${route.method} ${route.path}: handler pertama adalah controller`);
        assert.ok(controllerFnsList.includes(route.handlers[route.handlers.length - 1]), `${route.method} ${route.path}: handler terakhir bukan controller`);
    }
});

test('akses tiap rute sesuai matriks peran', () => {
    for (const route of routes) {
        const key = `${route.method} ${route.path}`;
        const allowed = POLICY[key];
        for (const [name, user] of Object.entries(USERS)) {
            const result = runAccess(route.handlers[0], user);
            const shouldPass = allowed.includes(name);
            assert.equal(result.nextCalled, shouldPass, `${key} untuk ${name}`);
            if (!shouldPass) {
                assert.equal(result.statusCode, name === 'anonymous' ? 401 : 403, `${key} untuk ${name}`);
            }
        }
    }
});

test('rute upload produksi: pembatasan akses dipasang sebelum middleware upload', () => {
    for (const key of ['POST /production/preview', 'POST /production/commit']) {
        const route = routes.find((r) => `${r.method} ${r.path}` === key);
        assert.equal(route.handlers.length, 3, key);
        assert.equal(route.handlers[1], uploadMarker, key);
        const customerResult = runAccess(route.handlers[0], USERS.customer);
        assert.equal(customerResult.nextCalled, false, key);
        assert.equal(customerResult.statusCode, 403, key);
    }
});
