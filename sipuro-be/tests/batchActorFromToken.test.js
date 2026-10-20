'use strict';

/**
 * Tes: pelaku aksi Batch selalu diambil dari token login (req.user), bukan dari body request.
 * Mencakup Force Close, ubah qty alokasi, dan commit upload produksi. Memakai database tiruan.
 * Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const state = {
    conn: null,
    resolveCalls: [],
    logCalls: []
};

const dbStub = { sipuroDb: { getConnection: async () => state.conn } };

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request.endsWith('/config/db')) return dbStub;
    if (request.endsWith('/helpers/batchHelper')) {
        return {
            refreshPOStatus: async () => {},
            refreshBatchStatus: async () => {},
            refreshBatchStatuses: async () => {},
            refreshPODetailFulfilledQty: async () => {}
        };
    }
    if (request.endsWith('/helpers/poBatchAllocationLogHelper')) {
        return { logAllocationUpdate: async (_conn, entries, userId) => { state.logCalls.push({ entries, userId }); } };
    }
    if (request.endsWith('/helpers/userValidationHelper')) {
        return { resolveValidUserId: async (_conn, id) => { state.resolveCalls.push(id); return id; } };
    }
    if (request.endsWith('/productionParserHelper')) {
        return { parseProductionExcel: () => ({ processTimestamp: 'ts', fileHash: 'hash', rawRows: [] }) };
    }
    if (request.endsWith('/productionCalculatorHelper')) {
        return { calculateFifoAllocation: () => ({ previewResults: [] }), computeAllocationFingerprint: () => 'fp' };
    }
    if (request.endsWith('/productionDataLoader')) {
        return { loadProductionContext: async () => ({ existingHashes: [], openPoDetails: [], allProducts: [], context: {} }) };
    }
    if (request.endsWith('/productionCommitHelper')) {
        return { commitProductionAllocationTransaction: async () => ({}) };
    }
    if (request.endsWith('/helpers/uploadConfig')) {
        return { COMMIT_LOCK_NAME: 'lock', COMMIT_LOCK_TIMEOUT_SECONDS: 1 };
    }
    return originalLoad.apply(this, arguments);
};

const { updateAllocationStatus } = require('../controllers/batch/allocated/batchStatusController');
const { updateAllocationQty } = require('../controllers/batch/allocated/batchEditQtyController');
const { commitExcelAllocation } = require('../controllers/batch/import/productionCommitController');

const makeRes = () => {
    const res = { statusCode: 200, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
};

const makeConn = (responder) => {
    const queries = [];
    return {
        queries,
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        query: async (sql, params) => {
            queries.push({ sql, params });
            return responder(sql, params);
        }
    };
};

const reset = () => {
    state.resolveCalls = [];
    state.logCalls = [];
};

test('Force Close: pelaku dari token, userId di body diabaikan', async () => {
    reset();
    state.conn = makeConn((sql) => {
        if (/FROM sipuro_db\.po_batch_allocations pba/.test(sql)) {
            return [[{ id: 1, po_detail_id: 10, id_batch: 3, allocated_qty: 5, allocation_status: 'Open', po_header_id: 2, base_qty: 100 }]];
        }
        if (/COALESCE\(SUM\(allocated_qty\)/.test(sql)) return [[{ total_allocated: 5 }]];
        return [{}];
    });
    const res = makeRes();
    await updateAllocationStatus({
        params: { allocationId: '1' },
        body: { action: 'FORCE_CLOSE', reason: 'tes', userId: 999 },
        user: { id: 7 }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(state.resolveCalls, [7]);
    assert.equal(state.logCalls[0].userId, 7);
    assert.equal(state.logCalls[0].entries[0].created_by, 7);
    const update = state.conn.queries.find((q) => /UPDATE sipuro_db\.po_batch_allocations SET status/.test(q.sql));
    assert.deepEqual(update.params, ['Force Closed', 7, '1']);
});

test('Ubah qty alokasi: pelaku dari token, userId di body diabaikan', async () => {
    reset();
    state.conn = makeConn((sql) => {
        if (/WHERE pba\.id = \?/.test(sql)) {
            return [[{ id: 1, po_detail_id: 10, id_batch: 3, allocated_qty: 5, allocation_status: 'Open', po_header_id: 2, base_qty: 100 }]];
        }
        if (/id <> \?/.test(sql)) return [[]];
        return [{}];
    });
    const res = makeRes();
    await updateAllocationQty({
        params: { allocationId: '1' },
        body: { newAllocatedQty: 50, reason: 'tes', userId: 999 },
        user: { id: 7 }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(state.resolveCalls, [7]);
    assert.equal(state.logCalls[0].userId, 7);
    const update = state.conn.queries.find((q) => /UPDATE sipuro_db\.po_batch_allocations\s+SET\s+allocated_qty/.test(q.sql));
    assert.deepEqual(update.params, [50, 'Open', 7, '1']);
});

test('Commit produksi: pelaku dari token, userId di body diabaikan', async () => {
    reset();
    state.conn = makeConn((sql, params) => {
        if (/GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
        if (/FROM employees WHERE id = \?/.test(sql)) return [[{ id: params[0] }]];
        if (/FROM production_upload_logs/.test(sql)) return [[]];
        return [[{}]];
    });
    const res = makeRes();
    await commitExcelAllocation({
        file: { buffer: Buffer.from(''), originalname: 'produksi.xlsx' },
        body: { userId: '999', fingerprint: 'fp' },
        user: { id: 7 }
    }, res);

    const employeeLookup = state.conn.queries.find((q) => /FROM employees WHERE id = \?/.test(q.sql));
    assert.deepEqual(employeeLookup.params, [7]);
    // Tiruan perhitungan tidak menghasilkan alokasi, jadi proses berhenti di tahap ini.
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /no valid allocation/i);
});

test('Commit produksi: tanpa pengguna di token ditolak, userId di body tidak dipakai', async () => {
    reset();
    let connectionRequested = false;
    dbStub.sipuroDb.getConnection = async () => { connectionRequested = true; return state.conn; };
    const res = makeRes();
    await commitExcelAllocation({
        file: { buffer: Buffer.from(''), originalname: 'produksi.xlsx' },
        body: { userId: '999', fingerprint: 'fp' }
    }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /valid user/i);
    assert.equal(connectionRequested, false);
});
