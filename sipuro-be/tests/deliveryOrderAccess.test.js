'use strict';

/**
 * Tes pembatasan akses rute Delivery Order (routes/doRoutes.js), dengan izin awal dari permissionDefaults:
 *  - daftar DO dan retur : PPIC, LOGISTIC, FINANCE
 *  - upload (preview dan commit): LOGISTIC saja
 *  - export Excel                : PPIC, LOGISTIC, FINANCE
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
const uploadMiddleware = function handleExcelUpload() {};

const { defaultGrants } = require('../services/access-permission/permissionDefaults');

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request === 'express') return fakeExpress;
    if (request.endsWith('/config/db')) return { sipuroDb: { query: async () => [defaultGrants().map(([group_code, menu_code, action]) => ({ group_code, menu_code, action }))] } };
    if (request.endsWith('/helpers/tokenHelper')) return { verifyToken() { throw new Error('tidak dipakai di tes'); } };
    if (request.endsWith('/middleware/excelUpload')) return { handleExcelUpload: uploadMiddleware };
    if (request.includes('/controllers/delivery-order/')) return controllerStub;
    return originalLoad.apply(this, arguments);
};

require('../routes/doRoutes');

const USERS = {
    customer: { type: 'CUSTOMER', role: 'CUSTOMER', department: null, customerId: 5 },
    ppic: { type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' },
    logistic: { type: 'EMPLOYEE', role: 'STAFF', department: 'LOGISTIC' },
    logisticsSpelling: { type: 'EMPLOYEE', role: 'MANAGER', department: 'LOGISTICS' },
    finance: { type: 'EMPLOYEE', role: 'MANAGER', department: 'FINANCE' },
    superadmin: { type: 'EMPLOYEE', role: 'SUPERADMIN', department: null },
    otherDepartment: { type: 'EMPLOYEE', role: 'STAFF', department: 'PRODUCT COSTING' },
    anonymous: undefined
};

const VIEWERS = ['ppic', 'logistic', 'logisticsSpelling', 'finance'];
const UPLOADERS = ['logistic', 'logisticsSpelling'];
const UPLOAD_ROUTES = ['POST /upload/preview', 'POST /upload/commit'];

const POLICY = {
    'GET /mapping': VIEWERS,
    'GET /estimated-po': VIEWERS,
    'GET /export': VIEWERS,
    'POST /upload/preview': UPLOADERS,
    'POST /upload/commit': UPLOADERS
};

const runAccess = async (handler, user) => {
    const out = { statusCode: null, nextCalled: false };
    const res = { status(code) { out.statusCode = code; return res; }, json() { return res; } };
    await handler({ user }, res, () => { out.nextCalled = true; });
    return out;
};

test('daftar rute sama persis dengan kebijakan akses (rute baru wajib diberi kebijakan)', () => {
    assert.deepEqual(routes.map((r) => `${r.method} ${r.path}`).sort(), Object.keys(POLICY).sort());
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

test('akses tiap rute sesuai matriks peran', async () => {
    for (const route of routes) {
        const key = `${route.method} ${route.path}`;
        for (const [name, user] of Object.entries(USERS)) {
            const result = await runAccess(route.handlers[0], user);
            const shouldPass = POLICY[key].includes(name);
            assert.equal(result.nextCalled, shouldPass, `${key} untuk ${name}`);
            if (!shouldPass) {
                assert.equal(result.statusCode, name === 'anonymous' ? 401 : 403, `${key} untuk ${name}`);
            }
        }
    }
});
