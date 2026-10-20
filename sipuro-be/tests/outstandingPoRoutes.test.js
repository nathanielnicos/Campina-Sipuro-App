'use strict';

/**
 * Tes akses rute Outstanding PO (routes/outstandingPoRoutes.js) dan urutan pendaftarannya di server.js.
 * Express diganti tiruan yang hanya mencatat rute; middleware auth yang asli dipakai menilai peran.
 * Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
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

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request === 'express') return fakeExpress;
    if (request.endsWith('/config/db')) return { sipuroDb: null };
    if (request.endsWith('/helpers/tokenHelper')) return { verifyToken() { throw new Error('tidak dipakai di tes'); } };
    if (request.endsWith('/controllers/outstanding-po/outstandingPoController')) return controllerStub;
    return originalLoad.apply(this, arguments);
};

require('../routes/outstandingPoRoutes');

const USERS = {
    customer: { type: 'CUSTOMER', role: 'CUSTOMER', department: null, customerId: 5 },
    ppic: { type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' },
    ppicManager: { type: 'EMPLOYEE', role: 'MANAGER', department: 'PPIC' },
    superadmin: { type: 'EMPLOYEE', role: 'SUPERADMIN', department: null },
    logistic: { type: 'EMPLOYEE', role: 'STAFF', department: 'LOGISTIC' },
    finance: { type: 'EMPLOYEE', role: 'STAFF', department: 'FINANCE' },
    anonymous: undefined
};

const POLICY = {
    'GET /': ['customer', 'ppic', 'ppicManager', 'superadmin'],
    'POST /items/:poDetailId/request-close': ['customer'],
    'POST /items/:poDetailId/approve-close': ['ppic', 'ppicManager'],
    'POST /items/:poDetailId/reject-close': ['ppic', 'ppicManager']
};

const runAccess = (handler, user) => {
    const out = { statusCode: null, nextCalled: false };
    const res = {
        status(code) { out.statusCode = code; return res; },
        json() { return res; }
    };
    handler({ user }, res, () => { out.nextCalled = true; });
    return out;
};

test('daftar rute sama persis dengan kebijakan akses (rute baru wajib diberi kebijakan)', () => {
    const registered = routes.map((r) => `${r.method} ${r.path}`).sort();
    assert.deepEqual(registered, Object.keys(POLICY).sort());
});

test('setiap rute punya middleware akses sebelum controller', () => {
    const fns = Object.values(controllerFns);
    for (const route of routes) {
        assert.equal(route.handlers.length, 2, `${route.method} ${route.path}`);
        assert.ok(!fns.includes(route.handlers[0]), `${route.method} ${route.path}: handler pertama adalah controller`);
        assert.ok(fns.includes(route.handlers[1]), `${route.method} ${route.path}: handler terakhir bukan controller`);
    }
});

test('akses tiap rute sesuai matriks peran', () => {
    for (const route of routes) {
        const key = `${route.method} ${route.path}`;
        for (const [name, user] of Object.entries(USERS)) {
            const result = runAccess(route.handlers[0], user);
            const shouldPass = POLICY[key].includes(name);
            assert.equal(result.nextCalled, shouldPass, `${key} untuk ${name}`);
            if (!shouldPass) {
                assert.equal(result.statusCode, name === 'anonymous' ? 401 : 403, `${key} untuk ${name}`);
            }
        }
    }
});

test('server.js mendaftarkan /api/outstanding-po SETELAH requireAuth', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const authAt = source.indexOf("app.use('/api', requireAuth)");
    const routeAt = source.indexOf("app.use('/api/outstanding-po', outstandingPoRoutes)");
    assert.ok(authAt >= 0, 'requireAuth global tidak ditemukan');
    assert.ok(routeAt >= 0, 'rute outstanding-po tidak terdaftar');
    assert.ok(authAt < routeAt, 'rute outstanding-po terdaftar sebelum requireAuth');
    assert.ok(source.includes("require('./routes/outstandingPoRoutes')"));
});
