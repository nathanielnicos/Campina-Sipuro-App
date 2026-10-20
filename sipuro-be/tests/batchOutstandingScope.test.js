'use strict';

/**
 * Tes ringkasan outstanding lama (controllers/batch/outstanding/outstandingSummaryController.js):
 * penyaringan per customer dari token, batas limit, urutan stabil, dan pesan error yang aman.
 * Memakai database tiruan. Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const dbStub = { sipuroDb: { query: async () => [[]] } };

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request.endsWith('/config/db')) return dbStub;
    return originalLoad.apply(this, arguments);
};

const { getOutstandingSummary } = require('../controllers/batch/outstanding/outstandingSummaryController');

const makeRes = () => {
    const res = { statusCode: 200, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
};

const withCalls = () => {
    const calls = [];
    dbStub.sipuroDb.query = async (sql, params) => {
        calls.push({ sql, params });
        if (/COUNT\(\*\) AS total/.test(sql)) return [[{ total: 0 }]];
        return [[]];
    };
    return calls;
};

const placeholderCount = (sql) => (sql.match(/\?/g) || []).length;

const CUSTOMER = { type: 'CUSTOMER', customerId: 7 };
const PPIC = { type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' };

test('customer: kedua query disaring dengan customer dari token, urutan parameter sesuai klausa', async () => {
    const calls = withCalls();
    const res = makeRes();
    await getOutstandingSummary({
        user: CUSTOMER,
        query: {
            page: '1', limit: '10', status: 'Active', searchProduct: 'FG', searchPo: 'PO-1',
            fromCreatedDate: '2026-01-01', toCreatedDate: '2026-01-31'
        }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 2);
    const expectedParams = [7, 'Active', '%FG%', '%FG%', '%PO-1%', '2026-01-01', '2026-01-31'];
    for (const call of calls) {
        assert.deepEqual(call.params, expectedParams);
        assert.equal(placeholderCount(call.sql), call.params.length);
        const order = ['h.customer_id = ?', 'd.status = ?', 'p.product_code LIKE ?', 'h.po_number LIKE ?', 'DATE(h.created_at) >= ?', 'DATE(h.created_at) <= ?']
            .map((fragment) => call.sql.indexOf(fragment));
        assert.ok(order.every((i) => i >= 0), 'klausa hilang');
        assert.deepEqual([...order].sort((a, b) => a - b), order, 'urutan klausa tidak sama dengan urutan parameter');
    }
});

test('customer tidak bisa mengganti customer lewat parameter request', async () => {
    const calls = withCalls();
    const res = makeRes();
    await getOutstandingSummary({ user: CUSTOMER, query: { customer_id: '99', customerId: '99', id_customer: '99' } }, res);
    for (const call of calls) assert.deepEqual(call.params, [7]);
});

test('customer tanpa customerId ditolak 403 dan tidak menjalankan query', async () => {
    const calls = withCalls();
    const res = makeRes();
    await getOutstandingSummary({ user: { type: 'CUSTOMER' }, query: {} }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(calls.length, 0);
});

test('PPIC: tanpa penyaringan customer', async () => {
    const calls = withCalls();
    const res = makeRes();
    await getOutstandingSummary({ user: PPIC, query: {} }, res);
    assert.equal(res.statusCode, 200);
    for (const call of calls) {
        assert.ok(!call.sql.includes('h.customer_id'));
        assert.deepEqual(call.params, []);
    }
});

test('limit dibatasi maksimum 100 dan nilai tidak valid kembali ke bawaan', async () => {
    const cases = [['100000', 100], ['100', 100], ['101', 100], ['25', 25], ['0', 10], ['abc', 10], ['-5', 1]];
    for (const [input, expected] of cases) {
        const calls = withCalls();
        const res = makeRes();
        await getOutstandingSummary({ user: PPIC, query: { limit: input } }, res);
        assert.equal(res.body.pagination.limit, expected, `limit=${input}`);
        assert.ok(calls[1].sql.includes(`LIMIT ${expected} OFFSET 0`), `limit=${input}`);
    }
});

test('urutan punya pembeda p.id_product dan kunci urutan tak dikenal kembali ke bawaan', async () => {
    const calls = withCalls();
    await getOutstandingSummary({ user: PPIC, query: { sortKey: 'total_po_count', sortOrder: 'desc' } }, makeRes());
    assert.ok(calls[1].sql.includes('ORDER BY total_po_count DESC, p.id_product ASC'));

    const calls2 = withCalls();
    await getOutstandingSummary({ user: PPIC, query: { sortKey: 'p.product_code; DROP TABLE x', sortOrder: 'asc' } }, makeRes());
    assert.ok(calls2[1].sql.includes('ORDER BY p.product_code ASC, p.id_product ASC'));
    assert.ok(!calls2[1].sql.includes('DROP'));
});

test('error database: detail hanya dikirim saat NODE_ENV=development', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalConsoleError = console.error;
    console.error = () => {};
    dbStub.sipuroDb.query = async () => { throw new Error('rahasia: detail SQL'); };
    try {
        for (const [env, expectDetail] of [['production', false], [undefined, false], ['development', true]]) {
            if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env;
            const res = makeRes();
            await getOutstandingSummary({ user: PPIC, query: {} }, res);
            assert.equal(res.statusCode, 500);
            assert.equal(res.body.success, false);
            if (expectDetail) assert.equal(res.body.error, 'rahasia: detail SQL');
            else assert.ok(!JSON.stringify(res.body).includes('rahasia'));
        }
    } finally {
        console.error = originalConsoleError;
        if (originalEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv;
    }
});
