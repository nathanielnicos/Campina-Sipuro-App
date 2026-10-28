'use strict';

/**
 * Tes pembatasan akses rute pemetaan kode produk: hanya SUPERADMIN (bukan PPIC).
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

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request === 'express') return fakeExpress;
    if (request.endsWith('/config/db')) return { sipuroDb: null };
    if (request.endsWith('/helpers/tokenHelper')) return { verifyToken() { throw new Error('tidak dipakai di tes'); } };
    if (request.includes('/controllers/product-code-mapping/')) return controllerStub;
    return originalLoad.apply(this, arguments);
};

require('../routes/productCodeMappingRoutes');

const USERS = {
    customer: { type: 'CUSTOMER', role: 'CUSTOMER', department: null },
    ppic: { type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' },
    ppicManager: { type: 'EMPLOYEE', role: 'MANAGER', department: 'PPIC' },
    superadmin: { type: 'EMPLOYEE', role: 'SUPERADMIN', department: null },
    logistic: { type: 'EMPLOYEE', role: 'STAFF', department: 'LOGISTIC' },
    finance: { type: 'EMPLOYEE', role: 'MANAGER', department: 'FINANCE' },
    anonymous: undefined
};

const POLICY = {
    'GET /': ['superadmin'],
    'POST /': ['superadmin'],
    'DELETE /:mappingId': ['superadmin']
};

const runAccess = (handler, user) => {
    const out = { statusCode: null, nextCalled: false };
    const res = { status(code) { out.statusCode = code; return res; }, json() { return res; } };
    handler({ user }, res, () => { out.nextCalled = true; });
    return out;
};

test('daftar rute sama persis dengan kebijakan akses', () => {
    assert.deepEqual(routes.map((r) => `${r.method} ${r.path}`).sort(), Object.keys(POLICY).sort());
});

test('setiap rute: pembatasan akses dahulu, controller terakhir', () => {
    const controllerList = Object.values(controllerFns);
    for (const route of routes) {
        assert.equal(route.handlers.length, 2);
        assert.ok(!controllerList.includes(route.handlers[0]));
        assert.ok(controllerList.includes(route.handlers[1]));
    }
});

test('hanya SUPERADMIN yang lolos; PPIC, customer, logistik, finance ditolak 403; anonim 401', () => {
    for (const route of routes) {
        const key = `${route.method} ${route.path}`;
        for (const [name, user] of Object.entries(USERS)) {
            const result = runAccess(route.handlers[0], user);
            const shouldPass = POLICY[key].includes(name);
            assert.equal(result.nextCalled, shouldPass, `${key} untuk ${name}`);
            if (!shouldPass) assert.equal(result.statusCode, name === 'anonymous' ? 401 : 403, `${key} untuk ${name}`);
        }
    }
});
