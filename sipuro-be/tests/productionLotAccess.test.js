'use strict';

/**
 * Tes pembatasan akses rute Production Lot (routes/productionLotRoutes.js):
 * seluruh rute (mapping, riwayat, preview, commit) hanya untuk PPIC (STAFF / MANAGER).
 * Express diganti tiruan; middleware auth yang asli dipakai. Tidak menyentuh database.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const routes = [];
const router = {};
['get', 'post', 'patch', 'put', 'delete'].forEach((method) => {
    router[method] = (routePath, ...handlers) => routes.push({ method: method.toUpperCase(), path: routePath, handlers });
});
router.use = () => { throw new Error('router.use global tidak boleh dipakai; pasang pembatasan per rute'); };
const fakeExpress = () => ({});
fakeExpress.Router = () => router;

const controllerFns = {};
const controllerStub = new Proxy({}, {
    get: (_target, name) => {
        if (!controllerFns[name]) controllerFns[name] = function controller() {};
        return controllerFns[name];
    }
});

// Penanda middleware upload: harus berada SETELAH pembatasan akses
const uploadMiddleware = function handleExcelUpload() {};

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request === 'express') return fakeExpress;
    if (request.endsWith('/config/db')) return { sipuroDb: null };
    if (request.endsWith('/helpers/tokenHelper')) return { verifyToken() { throw new Error('tidak dipakai di tes'); } };
    if (request.endsWith('/middleware/excelUpload')) return { handleExcelUpload: uploadMiddleware };
    if (request.endsWith('/controllers/production-lot/allocation/lotMappingListController')) return controllerStub;
    if (request.endsWith('/controllers/production-lot/allocation/lotAllocationLogController')) return controllerStub;
    if (request.endsWith('/controllers/production-lot/import/lotUploadPreviewController')) return controllerStub;
    if (request.endsWith('/controllers/production-lot/import/lotUploadCommitController')) return controllerStub;
    return originalLoad.apply(this, arguments);
};

require('../routes/productionLotRoutes');

const USERS = {
    customer: { type: 'CUSTOMER', role: 'CUSTOMER', department: null, customerId: 5 },
    ppic: { type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' },
    ppicManager: { type: 'EMPLOYEE', role: 'MANAGER', department: 'PPIC' },
    superadmin: { type: 'EMPLOYEE', role: 'SUPERADMIN', department: null },
    logistic: { type: 'EMPLOYEE', role: 'STAFF', department: 'LOGISTIC' },
    finance: { type: 'EMPLOYEE', role: 'STAFF', department: 'FINANCE' },
    anonymous: undefined
};

const PPIC_ONLY = ['ppic', 'ppicManager'];

const POLICY = {
    'GET /mapping': PPIC_ONLY,
    'GET /allocations/:allocationId/logs': PPIC_ONLY,
    'POST /upload/preview': PPIC_ONLY,
    'POST /upload/commit': PPIC_ONLY
};

const UPLOAD_ROUTES = ['POST /upload/preview', 'POST /upload/commit'];

const runAccess = (handler, user) => {
    const out = { statusCode: null, nextCalled: false };
    const res = { status(code) { out.statusCode = code; return res; }, json() { return res; } };
    handler({ user }, res, () => { out.nextCalled = true; });
    return out;
};

test('daftar rute sama persis dengan kebijakan akses (rute baru wajib diberi kebijakan)', () => {
    const registered = routes.map((r) => `${r.method} ${r.path}`).sort();
    assert.deepEqual(registered, Object.keys(POLICY).sort());
});

test('setiap rute punya middleware akses sebelum upload dan controller', () => {
    const controllerList = Object.values(controllerFns);
    for (const route of routes) {
        const key = `${route.method} ${route.path}`;
        assert.ok(route.handlers.length >= 2, `${key} tanpa middleware`);
        assert.ok(!controllerList.includes(route.handlers[0]), `${key}: handler pertama adalah controller`);
        assert.notEqual(route.handlers[0], uploadMiddleware, `${key}: upload berjalan sebelum pembatasan akses`);
        assert.ok(controllerList.includes(route.handlers[route.handlers.length - 1]), `${key}: handler terakhir bukan controller`);

        if (UPLOAD_ROUTES.includes(key)) {
            assert.equal(route.handlers[1], uploadMiddleware, `${key}: middleware upload harus tepat setelah pembatasan akses`);
        }
    }
});

test('akses tiap rute sesuai matriks peran (hanya PPIC)', () => {
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
