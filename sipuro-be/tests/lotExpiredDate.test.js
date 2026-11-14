'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

const state = { queries: [] };
const fakeDb = {
    query: async (sql, params) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        state.queries.push({ sql: text, params });
        if (/^SELECT COUNT\(\*\) AS total FROM \(SELECT 1/.test(text)) return [[{ total: 1 }]];
        if (/^SELECT COUNT\(\*\) AS total FROM delivery_returns/.test(text)) return [[{ total: 0 }]];
        return [[]];
    }
};

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    return originalLoad.apply(this, arguments);
};

const { fetchExportData } = require(path.join('..', 'services/delivery-order/deliveryOrderExportQuery'));
const { commitProductionAllocationTransaction } = require(path.join('..', 'services/production-lot/lotCommitService'));

test.beforeEach(() => { state.queries = []; });

test('export DO: tanggal lot diambil dari lot dengan produk yang sama, lalu cadangan per nomor lot', async () => {
    await fetchExportData(fakeDb, {
        deliveries: { whereSql: '1 = 1', params: [] },
        returns: { whereSql: '1 = 1', params: [] }
    });
    const q = state.queries.find((x) => /^SELECT d\.do_number/.test(x.sql));
    assert.ok(q, 'query pengiriman harus dijalankan');
    const exp = q.sql.match(/COALESCE\( ?\(SELECT DATE_FORMAT\(MIN\(l\.expired_date\).*?\) AS lot_expired_date/);
    assert.ok(exp, 'kolom lot_expired_date memakai COALESCE');
    assert.match(exp[0], /l\.lot_number = dol\.lot_number AND l\.id_product = p\.id_product/);
    assert.match(exp[0], /\), ?\(SELECT DATE_FORMAT\(MIN\(l\.expired_date\), '%Y-%m-%d'\) FROM lots l WHERE l\.lot_number = dol\.lot_number\)\)/);
    const done = q.sql.match(/COALESCE\( ?\(SELECT DATE_FORMAT\(MIN\(l\.actual_completed_datetime\).*?\) AS lot_completed_at/);
    assert.ok(done, 'kolom lot_completed_at juga per item');
    assert.match(done[0], /l\.id_product = p\.id_product/);
});

// Koneksi tiruan untuk alur commit: mencatat setiap SQL; SELECT mengembalikan hasil kosong
const makeConn = () => {
    const calls = [];
    return {
        calls,
        query: async (sql, params) => {
            const text = sql.replace(/\s+/g, ' ').trim();
            calls.push({ sql: text, params });
            if (/^INSERT INTO production_lot_upload_logs/.test(text)) return [{ insertId: 11 }];
            if (/^SELECT id, lot_number, id_product FROM lots/.test(text)) return [[{ id: 5, lot_number: 'L1', id_product: 3 }]];
            if (/^SELECT id, batch_number FROM batches/.test(text)) return [[{ id: 9, batch_number: 'B1' }]];
            return [[], []];
        }
    };
};

test('commit upload: batch baru dibuat tanpa kolom expired_date, lot tetap menyimpan expired_date', async () => {
    const conn = makeConn();
    await commitProductionAllocationTransaction(conn, {
        fileName: 'f.xlsx', processTimestamp: 't', fileHash: 'h', userId: 7,
        calculation: {
            newRows: [],
            previewResults: [{ batchNumber: 'B1', lotNumber: 'L1', idProduct: 3, actualCompletedDatetime: '2026-10-01 08:00:00', expiredDate: '2027-10-01' }],
            detailedAllocations: []
        }
    });

    const batchInsert = conn.calls.find((c) => /^INSERT INTO batches/.test(c.sql));
    assert.ok(batchInsert, 'batch baru harus disimpan');
    assert.doesNotMatch(batchInsert.sql, /expired_date/);
    const row = batchInsert.params[0][0];
    assert.equal(row.length, 8, 'jumlah nilai sama dengan jumlah kolom');
    assert.deepEqual(row, ['B1', 3, null, null, null, 'Open', 7, 7]);

    const lotInsert = conn.calls.find((c) => /^INSERT INTO lots/.test(c.sql));
    assert.ok(lotInsert, 'lot tetap disimpan');
    assert.match(lotInsert.sql, /expired_date = COALESCE\(expired_date, VALUES\(expired_date\)\)/);
    assert.equal(lotInsert.params[0][0][3], '2027-10-01');
});
