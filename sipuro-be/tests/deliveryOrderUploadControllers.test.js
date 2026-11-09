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
        if (/FROM delivery_order_upload_logs/.test(sql)) return [existingLogs];
        return [[]];
    },
    beginTransaction: async () => events.push(['begin']),
    commit: async () => events.push(['commit']),
    rollback: async () => events.push(['rollback']),
    release: () => events.push(['release'])
};
const fakeDb = {
    getConnection: async () => connection,
    query: async (sql, params) => {
        events.push(['db.query', sql.replace(/\s+/g, ' ').trim(), params]);
        if (/FROM delivery_order_upload_logs/.test(sql)) return [existingLogs];
        return [[]];
    }
};

let calculation;
let fingerprint = 'FP1';
let parseImpl;
let commitImpl;
const calls = { load: [], commit: [] };

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    if (request.endsWith('/deliveryOrderUploadParser')) return { parseDeliveryOrderExcel: (...a) => parseImpl(...a) };
    if (request.endsWith('/deliveryOrderCalculator')) {
        return { calculateDeliveryOrders: () => calculation, computeDeliveryFingerprint: () => fingerprint };
    }
    if (request.endsWith('/deliveryOrderContextLoader')) {
        return { loadDeliveryOrderContext: async (c, rows, opts) => { calls.load.push([c, rows, opts]); return { existingHashes: [], allProducts: [], stock: {} }; } };
    }
    if (request.endsWith('/deliveryOrderCommitService')) {
        return { commitDeliveryOrderTransaction: async (c, args) => { calls.commit.push([c, args]); return commitImpl(c, args); } };
    }
    return originalLoad.apply(this, arguments);
};
const { commitDeliveryOrderUpload } = require(path.join('..', 'controllers/delivery-order/import/deliveryOrderUploadCommitController'));
const { previewDeliveryOrderUpload } = require(path.join('..', 'controllers/delivery-order/import/deliveryOrderUploadPreviewController'));
const { BusinessError } = require('../helpers/businessError');

const makeRes = () => {
    const res = { code: 200, body: null };
    res.status = (c) => { res.code = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};
const makeReq = (over = {}) => ({
    file: { buffer: Buffer.from('x'), originalname: 'do.xlsx' },
    body: { fingerprint: 'FP1', userId: 999 },
    user: { id: 4 },
    ...over
});

test.beforeEach(() => {
    events = []; lockAcquired = 1; actorExists = true; existingLogs = [];
    calls.load.length = 0; calls.commit.length = 0;
    calculation = { canSave: true, doLines: [{ a: 1 }], returnLines: [], categorizedDetails: { newRows: [] }, summary: {} };
    fingerprint = 'FP1';
    parseImpl = () => ({ processTimestamp: 'TS', fileHash: 'HASH', rawRows: [{ r: 1 }] });
    commitImpl = async () => ({ uploadLogId: 7 });
});

const queriesOf = () => events.filter((e) => e[0] === 'query').map((e) => e[1]);

test('commit sukses: lock bersama, READ COMMITTED, pelaku dari token (userId body diabaikan), commit, lock dilepas', async () => {
    const res = makeRes();
    await commitDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, { uploadLogId: 7 });

    const order = events.map((e) => e[0] === 'query' ? e[1].split(' ')[0] + ' ' + (e[1].match(/GET_LOCK|RELEASE_LOCK|ISOLATION|employees|delivery_order_upload_logs/) || [''])[0] : e[0]);
    assert.ok(order.indexOf('SELECT GET_LOCK') < order.indexOf('begin'));
    assert.ok(order.indexOf('begin') < order.indexOf('commit'));
    assert.ok(order.indexOf('commit') < order.indexOf('SELECT RELEASE_LOCK'));
    assert.ok(queriesOf().some((q) => /ISOLATION LEVEL READ COMMITTED/.test(q)));
    const lockCall = events.find((e) => /GET_LOCK/.test(e[1] || ''));
    assert.equal(lockCall[2][0], 'sipuro_upload_commit');
    assert.equal(events.find((e) => /FROM employees/.test(e[1] || ''))[2][0], 4);
    assert.equal(calls.commit[0][1].userId, 4);
    assert.equal(calls.load[0][2].forUpdate, true);
});

test('commit ditolak: tanpa file, tanpa fingerprint, pengguna tidak sah', async () => {
    let res = makeRes();
    await commitDeliveryOrderUpload(makeReq({ file: undefined }), res);
    assert.equal(res.code, 400);

    res = makeRes();
    await commitDeliveryOrderUpload(makeReq({ body: {} }), res);
    assert.equal(res.code, 400);

    res = makeRes();
    await commitDeliveryOrderUpload(makeReq({ user: undefined }), res);
    assert.equal(res.code, 400);
    assert.equal(calls.commit.length, 0);
});

test('commit ditolak 409: file sudah pernah di-commit; rollback dan lock dilepas', async () => {
    existingLogs = [{ id: 1 }];
    const res = makeRes();
    await commitDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.code, 409);
    assert.match(res.body.message, /already been committed/);
    assert.ok(events.some((e) => e[0] === 'rollback'));
    assert.ok(queriesOf().some((q) => /RELEASE_LOCK/.test(q)));
    assert.equal(calls.commit.length, 0);
});

test('commit ditolak 409: fingerprint berbeda dari preview', async () => {
    fingerprint = 'LAIN';
    const res = makeRes();
    await commitDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.code, 409);
    assert.match(res.body.message, /changed since the preview/);
    assert.equal(calls.commit.length, 0);
});

test('commit ditolak 400: tidak ada DO atau retur yang valid', async () => {
    calculation = { canSave: false, doLines: [], returnLines: [], categorizedDetails: { newRows: [] }, summary: {} };
    const res = makeRes();
    await commitDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.code, 400);
});

test('commit: sibuk -> 409; duplikat database -> 409 pesan jelas; error sistem -> 500 generik tanpa bocor pesan SQL', async () => {
    lockAcquired = 0;
    let res = makeRes();
    await commitDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.code, 409);
    lockAcquired = 1;

    commitImpl = async () => { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; e.sqlMessage = "Duplicate entry for key 'uk_dou_file_hash'"; throw e; };
    res = makeRes();
    await commitDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.code, 409);
    assert.match(res.body.message, /already been committed/);

    commitImpl = async () => { throw new Error("secret SQL detail 'x'"); };
    const original = console.error;
    console.error = () => {};
    res = makeRes();
    await commitDeliveryOrderUpload(makeReq(), res);
    console.error = original;
    assert.equal(res.code, 500);
    assert.ok(!/secret/.test(res.body.message));
});

test('commit: deadlock database dijawab 409 yang ramah', async () => {
    commitImpl = async () => { const e = new Error('deadlock'); e.code = 'ER_LOCK_DEADLOCK'; throw e; };
    const res = makeRes();
    await commitDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.code, 409);
});

test('preview: mengembalikan hasil hitung + fingerprint; file duplikat hanya memberi peringatan; tidak ada penulisan', async () => {
    let res = makeRes();
    await previewDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.data.fingerprint, 'FP1');
    assert.equal(res.body.data.isReupload, false);
    assert.equal(res.body.data.canSave, true);
    assert.equal(calls.load[0][2], undefined);

    existingLogs = [{ id: 1 }];
    res = makeRes();
    await previewDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.body.data.isReupload, true);
    assert.ok(res.body.data.warningMessage);
    assert.ok(events.every((e) => !/INSERT|UPDATE|DELETE/.test(e[1] || '')));
});

test('preview: baris yang dilewati karena Trans Type tidak dikenali diteruskan ke respons (default kosong)', async () => {
    let res = makeRes();
    await previewDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.body.data.skippedRowCount, 0);
    assert.deepEqual(res.body.data.skippedTransTypes, []);

    const skipped = [{ transType: 'Foo', rowCount: 2, sampleRows: [7, 8] }];
    parseImpl = () => ({ processTimestamp: 'TS', fileHash: 'HASH', rawRows: [], skippedRowCount: 2, skippedTransTypes: skipped });
    res = makeRes();
    await previewDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.body.data.skippedRowCount, 2);
    assert.deepEqual(res.body.data.skippedTransTypes, skipped);
});

test('preview: tanpa file -> 400; error parser BusinessError diteruskan; error sistem -> 500 generik', async () => {
    let res = makeRes();
    await previewDeliveryOrderUpload(makeReq({ file: undefined }), res);
    assert.equal(res.code, 400);

    parseImpl = () => { throw new BusinessError('Process timestamp not found in file header (Cell K1).', 422); };
    res = makeRes();
    await previewDeliveryOrderUpload(makeReq(), res);
    assert.equal(res.code, 422);

    parseImpl = () => { throw new Error('boom internal'); };
    const original = console.error;
    console.error = () => {};
    res = makeRes();
    await previewDeliveryOrderUpload(makeReq(), res);
    console.error = original;
    assert.equal(res.code, 500);
    assert.ok(!/boom/.test(res.body.message));
});
