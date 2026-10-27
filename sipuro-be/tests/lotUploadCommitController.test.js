'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

let events = [];
let lockAcquired = 1;
let actorExists = true;
let existingLogs = [];
const connection = {
    query: async (sql, params) => {
        events.push(['query', sql.replace(/\s+/g, ' ').trim(), params]);
        if (/GET_LOCK/.test(sql)) return [[{ acquired: lockAcquired }]];
        if (/FROM employees/.test(sql)) return [actorExists ? [{ id: params[0] }] : []];
        if (/FROM production_lot_upload_logs/.test(sql)) return [existingLogs];
        return [[]];
    },
    beginTransaction: async () => events.push(['begin']),
    commit: async () => events.push(['commit']),
    rollback: async () => events.push(['rollback']),
    release: () => events.push(['release'])
};
const fakeDb = { getConnection: async () => connection };

let calculation;
let fingerprint = 'FP1';
let parseImpl;
let commitImpl;
const calls = { load: [], commit: [] };

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    if (request.endsWith('/lotUploadParser')) return { parseProductionExcel: (...a) => parseImpl(...a) };
    if (request.endsWith('/lotAllocationCalculator')) {
        return { calculateLotFifoAllocation: () => calculation, computeAllocationFingerprint: () => fingerprint };
    }
    if (request.endsWith('/lotContextLoader')) {
        return { loadProductionLotContext: async (c, rows, opts) => { calls.load.push([c, rows, opts]); return { existingHashes: [], openPoDetails: [], allProducts: [], context: {} }; } };
    }
    if (request.endsWith('/lotCommitService')) {
        return { commitProductionAllocationTransaction: async (c, args) => { calls.commit.push([c, args]); return commitImpl(c, args); } };
    }
    return originalLoad.apply(this, arguments);
};
const { commitExcelAllocation } = require(path.join('..', 'controllers/production-lot/import/lotUploadCommitController'));
const { BusinessError } = require('../helpers/businessError');

const makeRes = () => {
    const res = { code: 200, body: null };
    res.status = (c) => { res.code = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};
const makeReq = (over = {}) => ({
    file: { buffer: Buffer.from('x'), originalname: 'prod.xlsx' },
    body: { fingerprint: 'FP1', userId: 999 },
    user: { id: 4 },
    ...over
});

test.beforeEach(() => {
    events = []; lockAcquired = 1; actorExists = true; existingLogs = [];
    calls.load.length = 0; calls.commit.length = 0;
    calculation = { previewResults: [{ g: 1 }] };
    fingerprint = 'FP1';
    parseImpl = () => ({ processTimestamp: 'TS', fileHash: 'HASH', rawRows: [{ r: 1 }] });
    commitImpl = async () => ({ uploadLogId: 7 });
});
const originalError = console.error;
test.before(() => { console.error = () => {}; });
test.after(() => { console.error = originalError; });

const hasEvent = (kind) => events.some((e) => e[0] === kind);

test('sukses: pelaku dari token, loader dengan forUpdate, commit dipanggil, transaksi di-commit', async () => {
    const res = makeRes();
    await commitExcelAllocation(makeReq(), res);

    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { success: true, message: 'Production lot allocation successfully saved to database.', data: { uploadLogId: 7 } });
    assert.deepEqual(calls.load[0][2], { forUpdate: true });
    assert.equal(calls.commit[0][1].userId, 4);
    assert.equal(calls.commit[0][1].fileName, 'prod.xlsx');
    assert.equal(calls.commit[0][1].fileHash, 'HASH');
    assert.equal(calls.commit[0][1].processTimestamp, 'TS');
    assert.equal(calls.commit[0][1].calculation, calculation);
    assert.ok(hasEvent('commit') && !hasEvent('rollback'));
    const dup = events.find((e) => e[0] === 'query' && /FROM production_lot_upload_logs/.test(e[1]));
    assert.deepEqual(dup[2], ['HASH', 'TS']);
});

test('tanpa file -> 400; tanpa fingerprint -> 400; tanpa token -> 400; semuanya sebelum koneksi', async () => {
    for (const req of [makeReq({ file: undefined }), makeReq({ body: {} }), makeReq({ body: undefined }), makeReq({ body: { fingerprint: '  ' } }), makeReq({ user: undefined })]) {
        const res = makeRes();
        await commitExcelAllocation(req, res);
        assert.equal(res.code, 400);
    }
    assert.equal(events.length, 0);
});

test('file tidak terbaca (parser) -> status error parser diteruskan, tanpa koneksi', async () => {
    parseImpl = () => { throw new BusinessError('Bad file', 422); };
    const res = makeRes();
    await commitExcelAllocation(makeReq(), res);
    assert.equal(res.code, 422);
    assert.equal(events.length, 0);
});

test('log upload sudah ada -> 409, rollback, tidak memuat konteks', async () => {
    existingLogs = [{ id: 3 }];
    const res = makeRes();
    await commitExcelAllocation(makeReq(), res);
    assert.equal(res.code, 409);
    assert.match(res.body.message, /already been committed/);
    assert.equal(calls.load.length, 0);
    assert.ok(hasEvent('rollback'));
});

test('fingerprint berbeda -> 409, tidak menyimpan', async () => {
    fingerprint = 'LAIN';
    const res = makeRes();
    await commitExcelAllocation(makeReq(), res);
    assert.equal(res.code, 409);
    assert.match(res.body.message, /changed since the preview/);
    assert.equal(calls.commit.length, 0);
    assert.ok(hasEvent('rollback'));
});

test('tidak ada alokasi valid -> 400, tidak menyimpan', async () => {
    calculation = { previewResults: [] };
    const res = makeRes();
    await commitExcelAllocation(makeReq(), res);
    assert.equal(res.code, 400);
    assert.match(res.body.message, /no valid lot allocation/);
    assert.equal(calls.commit.length, 0);
});

test('pelaku tidak ada -> 400; lock sibuk -> 409 dengan pesan upload', async () => {
    actorExists = false;
    let res = makeRes();
    await commitExcelAllocation(makeReq(), res);
    assert.equal(res.code, 400);
    assert.equal(calls.load.length, 0);

    actorExists = true; lockAcquired = 0; events = [];
    res = makeRes();
    await commitExcelAllocation(makeReq(), res);
    assert.equal(res.code, 409);
    assert.equal(res.body.message, 'Another production lot upload is being saved. Please try again in a moment.');
    assert.ok(!hasEvent('begin'));
});

test('ER_DUP_ENTRY diterjemahkan menjadi 409 yang jelas', async () => {
    const dup = (sqlMessage) => { commitImpl = async () => { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; e.sqlMessage = sqlMessage; throw e; }; };

    dup("Duplicate entry 'x' for key 'file_hash'");
    let res = makeRes();
    await commitExcelAllocation(makeReq(), res);
    assert.equal(res.code, 409);
    assert.match(res.body.message, /already been committed/);

    dup("Duplicate entry 'B1' for key 'batch_number'");
    res = makeRes();
    await commitExcelAllocation(makeReq(), res);
    assert.equal(res.code, 409);
    assert.match(res.body.message, /batch or lot number was created/);

    dup("Duplicate entry 'x' for key 'lain'");
    res = makeRes();
    await commitExcelAllocation(makeReq(), res);
    assert.equal(res.code, 409);
    assert.match(res.body.message, /Duplicate data detected/);
    assert.ok(hasEvent('rollback'));
});

test('error sistem -> 500 generik tanpa membocorkan detail', async () => {
    commitImpl = async () => { throw new Error('SELECT password FROM x'); };
    const res = makeRes();
    await commitExcelAllocation(makeReq(), res);
    assert.equal(res.code, 500);
    assert.ok(!/password/.test(JSON.stringify(res.body)));
});
