'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

const state = { queries: [], replies: [], toleranceRows: [[{ po_tolerance_percent: '5.5' }]], toleranceError: null, logRows: null };
const fakeDb = {
    query: async (sql, params) => {
        if (/company_profile/.test(sql)) {
            if (state.toleranceError) throw state.toleranceError;
            return state.toleranceRows;
        }
        if (/po_lot_allocation_logs/.test(sql)) return state.logRows(sql, params);
        state.queries.push({ sql, params });
        return [state.replies.shift() || []];
    }
};

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    if (request.endsWith('/helpers/poLogHelper')) return { logPOHeader: async () => {} };
    return originalLoad.apply(this, arguments);
};

const { getAllocatedLotMapping } = require(path.join('..', 'controllers/production-lot/allocation/lotMappingListController'));
const { getAllocationHistory } = require(path.join('..', 'controllers/production-lot/allocation/lotAllocationLogController'));

const call = async (handler, req) => {
    const out = { status: 200, body: null };
    const res = { status(c) { out.status = c; return res; }, json(b) { out.body = b; return res; } };
    await handler(req, res);
    return out;
};

test.beforeEach(() => {
    state.queries = []; state.replies = []; state.toleranceError = null;
    state.toleranceRows = [[{ po_tolerance_percent: '5.5' }]];
});

test('daftar BY_PO: respons berisi toleransi dalam persen dan pagination', async () => {
    state.replies = [[{ total: 25 }], [{ page_key: 1 }], []];
    const r = await call(getAllocatedLotMapping, { query: { limit: '10', page: '2' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.displayMode, 'BY_PO');
    assert.equal(r.body.poTolerance, 5.5);
    assert.deepEqual(r.body.pagination, { totalItems: 25, totalPages: 3, currentPage: 2, limit: 10 });
});

test('toleransi 0 tetap 0 (bukan 100)', async () => {
    state.toleranceRows = [[{ po_tolerance_percent: 0 }]];
    state.replies = [[{ total: 0 }]];
    const r = await call(getAllocatedLotMapping, { query: {} });
    assert.equal(r.body.poTolerance, 0);
});

test('toleransi belum diatur atau gagal dibaca: daftar tetap tampil, poTolerance null', async () => {
    state.toleranceRows = [[]];
    state.replies = [[{ total: 0 }]];
    const a = await call(getAllocatedLotMapping, { query: {} });
    assert.equal(a.status, 200);
    assert.equal(a.body.poTolerance, null);

    state.toleranceError = new Error('db down');
    state.replies = [[{ total: 0 }]];
    const b = await call(getAllocatedLotMapping, { query: {} });
    assert.equal(b.status, 200);
    assert.equal(b.body.poTolerance, null);
});

test('mode selain BY_PO tidak mengirim toleransi', async () => {
    state.replies = [[{ total: 0 }]];
    const r = await call(getAllocatedLotMapping, { query: { displayMode: 'BY_LOT' } });
    assert.ok(!('poTolerance' in r.body));
});

test('parameter tidak valid dijawab 400 tanpa query ke database', async () => {
    for (const query of [{ displayMode: 'X' }, { status: 'zzz' }, { fromActualDate: '2026-99-99' }]) {
        const r = await call(getAllocatedLotMapping, { query });
        assert.equal(r.status, 400);
        assert.equal(state.queries.length, 0);
    }
});

test('error database dijawab 500 generik tanpa detail SQL', async () => {
    const original = fakeDb.query;
    fakeDb.query = async (sql) => { if (/COUNT/.test(sql)) throw new Error("secret table detail"); return original(sql); };
    const r = await call(getAllocatedLotMapping, { query: {} });
    fakeDb.query = original;
    assert.equal(r.status, 500);
    assert.equal(r.body.message, 'Failed to fetch lot mapping list.');
    assert.ok(!JSON.stringify(r.body).includes('secret'));
});

test('riwayat: ID tidak valid 400; limit dibatasi 100; id_batch ikut dibaca', async () => {
    const seen = [];
    state.logRows = async (sql, params) => {
        seen.push({ sql, params });
        return /COUNT/.test(sql) ? [[{ totalItems: 0 }]] : [[]];
    };
    for (const allocationId of ['abc', '0', '-1', '1.5', '']) {
        const r = await call(getAllocationHistory, { params: { allocationId }, query: {} });
        assert.equal(r.status, 400, allocationId);
    }
    assert.equal(seen.length, 0);

    const ok = await call(getAllocationHistory, { params: { allocationId: '9' }, query: { limit: '5000' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.pagination.limit, 100);
    assert.match(seen[1].sql, /log\.id_batch/);
});

test('riwayat: error database dijawab 500 generik', async () => {
    state.logRows = async () => { throw new Error('boom internal'); };
    const r = await call(getAllocationHistory, { params: { allocationId: '9' }, query: {} });
    assert.equal(r.status, 500);
    assert.ok(!JSON.stringify(r.body).includes('boom'));
});
