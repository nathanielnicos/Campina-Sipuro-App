'use strict';

/**
 * saveProductionPlan: simpan aman. Database diganti tiruan yang mencatat SQL.
 * Menguji: validasi menolak sebelum menyentuh DB, aktor dari token, upsert tanpa DELETE,
 * pencocokan revisi lewat id, dan rollback pada konflik.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

let log = [];
let existingRevisions = [];
let released = 0;
let rolledBack = 0;
let committed = 0;

const connection = {
    async query(sql, params) {
        log.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
        if (/SELECT id_product FROM sipuro_db.products/.test(sql)) return [[{ id_product: 5 }]];
        if (/SELECT id_plan FROM sipuro_db.production_plans/.test(sql)) return [[{ id_plan: 9 }]];
        if (/SELECT id_revision, revision_type/.test(sql)) return [existingRevisions];
        if (/INSERT INTO sipuro_db.production_plan_revisions/.test(sql)) return [{ insertId: 100 + log.length }];
        return [{}];
    },
    async beginTransaction() { log.push({ sql: 'BEGIN' }); },
    async commit() { committed += 1; },
    async rollback() { rolledBack += 1; },
    release() { released += 1; }
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: { getConnection: async () => connection } };
    return originalLoad.apply(this, arguments);
};
const { saveProductionPlan } = require('../controllers/productionSchedule/productionPlan/productionPlanManageController');

const fakeRes = () => {
    const res = { statusCode: 200, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};

const weeksData = (v) => ({ '2026_10': v, '2026_11': v });
const body = (revisions, extra = {}) => ({
    id_product: 5, start_week: '2026-W10', end_week: '2026-W11', created_by: 'attacker', revisions, ...extra
});
const run = async (b, user = { id: 42, type: 'EMPLOYEE' }) => {
    log = []; released = 0; rolledBack = 0; committed = 0;
    const res = fakeRes();
    await saveProductionPlan({ body: b, user }, res);
    return res;
};
const rev = (type, v, extra = {}) => ({ revision_type: type, revision_label: `L ${type}`, revision_date: '2026-10-21', weeks_data: weeksData(v), ...extra });

test('data tidak valid ditolak 400 sebelum koneksi dipakai', async () => {
    const res = await run(body([rev('PROPOSED', -1), rev('CAMPINA_PLAN', 1)]));
    assert.equal(res.statusCode, 400);
    assert.equal(log.length, 0);
    assert.equal(committed, 0);
});

test('plan baru: aktor dari token, bukan dari body; item di-upsert; tanpa DELETE', async () => {
    existingRevisions = [];
    const res = await run(body([rev('PROPOSED', 10), rev('CAMPINA_PLAN', 20)]));
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(committed, 1);
    assert.equal(released, 1);
    assert.ok(!log.some((l) => /DELETE/i.test(l.sql)), 'tidak boleh ada DELETE');

    const planInsert = log.find((l) => /INSERT IGNORE INTO sipuro_db.production_plans/.test(l.sql));
    assert.deepEqual(planInsert.params, [5, 42, 42]);
    const revInserts = log.filter((l) => /INSERT INTO sipuro_db.production_plan_revisions/.test(l.sql));
    assert.equal(revInserts.length, 2);
    for (const r of revInserts) assert.equal(r.params[4], 42);
    assert.ok(!JSON.stringify(log).includes('attacker'));

    const itemInserts = log.filter((l) => /production_plan_items/.test(l.sql));
    assert.equal(itemInserts.length, 2);
    assert.match(itemInserts[0].sql, /ON DUPLICATE KEY UPDATE qty = VALUES\(qty\)/);
    assert.equal(itemInserts[0].params[0].length, 2); // hanya 2 minggu pada jendela
});

test('revisi lama dicocokkan lewat id: hanya item yang di-upsert, tidak ada insert revisi baru', async () => {
    existingRevisions = [
        { id_revision: 1, revision_type: 'PROPOSED' },
        { id_revision: 2, revision_type: 'CAMPINA_PLAN' }
    ];
    const res = await run(body([rev('PROPOSED', 3, { id_revision: 1 }), rev('CAMPINA_PLAN', 4, { id_revision: 2 })]));
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.ok(!log.some((l) => /INSERT INTO sipuro_db.production_plan_revisions/.test(l.sql)));
    assert.ok(!log.some((l) => /DELETE/i.test(l.sql)));
    const items = log.filter((l) => /production_plan_items/.test(l.sql));
    assert.deepEqual(items.map((i) => i.params[0][0][0]), [1, 2]);
});

test('revisi baru ditambahkan di samping revisi lama tanpa membuat Campina kedua', async () => {
    existingRevisions = [
        { id_revision: 1, revision_type: 'PROPOSED' },
        { id_revision: 2, revision_type: 'CAMPINA_PLAN' }
    ];
    const res = await run(body([
        rev('PROPOSED', 3, { id_revision: 1 }), rev('REVISION', 5), rev('CAMPINA_PLAN', 5, { id_revision: 2 })
    ]));
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(log.filter((l) => /INSERT INTO sipuro_db.production_plan_revisions/.test(l.sql)).length, 1);
});

test('Campina baru tanpa id saat sudah ada di DB ditolak 409 dan di-rollback', async () => {
    existingRevisions = [{ id_revision: 2, revision_type: 'CAMPINA_PLAN' }];
    const res = await run(body([rev('PROPOSED', 1), rev('CAMPINA_PLAN', 1)]));
    assert.equal(res.statusCode, 409);
    assert.equal(rolledBack, 1);
    assert.equal(committed, 0);
    assert.equal(released, 1);
});

test('id revisi yang bukan milik plan ditolak 409', async () => {
    existingRevisions = [{ id_revision: 2, revision_type: 'CAMPINA_PLAN' }];
    const res = await run(body([rev('PROPOSED', 1, { id_revision: 77 }), rev('CAMPINA_PLAN', 1, { id_revision: 2 })]));
    assert.equal(res.statusCode, 409);
    assert.equal(rolledBack, 1);
});

test('tipe revisi lama tidak boleh diubah', async () => {
    existingRevisions = [{ id_revision: 1, revision_type: 'PROPOSED' }, { id_revision: 2, revision_type: 'CAMPINA_PLAN' }];
    const res = await run(body([rev('REVISION', 1, { id_revision: 1 }), rev('CAMPINA_PLAN', 1, { id_revision: 2 })]));
    assert.equal(res.statusCode, 400);
    assert.equal(committed, 0);
});

test('tanpa user di token ditolak 401', async () => {
    const res = await run(body([rev('PROPOSED', 1), rev('CAMPINA_PLAN', 1)]), null);
    assert.equal(res.statusCode, 401);
    assert.equal(log.length, 0);
});

test('error SQL tidak membocorkan detail ke klien', async () => {
    existingRevisions = [];
    const original = connection.query;
    connection.query = async () => { throw new Error('secret table detail'); };
    const res = await run(body([rev('PROPOSED', 1), rev('CAMPINA_PLAN', 1)]));
    connection.query = original;
    assert.equal(res.statusCode, 500);
    assert.ok(!JSON.stringify(res.body).includes('secret'));
    assert.equal(rolledBack, 1);
});
