'use strict';

/**
 * Tes pembatasan akses rute Production Schedule (routes/productionScheduleRoutes.js):
 * melihat untuk PPIC dan SUPERADMIN, mengubah/membuat hanya PPIC.
 * Express diganti tiruan; middleware auth yang asli dipakai. Tidak menyentuh database.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const routes = [];
const router = {};
['get', 'post', 'patch', 'put'].forEach((method) => {
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
    if (request.endsWith('/controllers/productionSchedule/productionScheduleController')) return controllerStub;
    return originalLoad.apply(this, arguments);
};

require('../routes/productionScheduleRoutes');

const USERS = {
    customer: { type: 'CUSTOMER', role: 'CUSTOMER', department: null, customerId: 5 },
    ppic: { type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' },
    ppicManager: { type: 'EMPLOYEE', role: 'MANAGER', department: 'PPIC' },
    superadmin: { type: 'EMPLOYEE', role: 'SUPERADMIN', department: null },
    logistic: { type: 'EMPLOYEE', role: 'STAFF', department: 'LOGISTIC' },
    finance: { type: 'EMPLOYEE', role: 'STAFF', department: 'FINANCE' },
    anonymous: undefined
};

const VIEW = ['ppic', 'ppicManager', 'superadmin'];
const PPIC_ONLY = ['ppic', 'ppicManager'];

const POLICY = {
    'GET /po-requirement/summary': VIEW,
    'GET /po-requirement/customers': VIEW,
    'GET /production-plan': VIEW,
    'GET /po-requirement/detail/:id_product': VIEW,
    'GET /production-plan/:id_product': VIEW,
    'POST /po-requirement/create-draft-po': PPIC_ONLY,
    'POST /production-plan/save': PPIC_ONLY
};

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

test('setiap rute punya middleware akses sebelum controller', () => {
    const controllerList = Object.values(controllerFns);
    for (const route of routes) {
        assert.ok(route.handlers.length >= 2, `${route.method} ${route.path} tanpa middleware`);
        assert.ok(!controllerList.includes(route.handlers[0]), `${route.method} ${route.path}: handler pertama adalah controller`);
        assert.ok(controllerList.includes(route.handlers[route.handlers.length - 1]), `${route.method} ${route.path}: handler terakhir bukan controller`);
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
