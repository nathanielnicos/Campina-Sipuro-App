'use strict';

/**
 * PO Requirement harus memakai definisi "outstanding" yang sama dengan menu Outstanding PO
 * (helpers/po/openItemRules.js). Database diganti tiruan yang mencatat SQL.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const queries = [];
let nextRows = [];
const fakeDb = {
    async query(sql, params) {
        queries.push({ sql, params });
        const rows = nextRows.shift() || [];
        return [rows];
    }
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    return originalLoad.apply(this, arguments);
};

const rules = require('../helpers/po/openItemRules');
const queryHelper = require('../helpers/outstanding-po/outstandingQueryHelper');
const controller = require('../controllers/productionSchedule/poRequirement/poRequirementGetController');

const fakeRes = () => {
    const res = { statusCode: 200, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};
const norm = (s) => s.replace(/\s+/g, ' ');

test('aturan item terbuka: IFNULL pada fulfilled_qty dan hanya status berjalan', () => {
    assert.match(rules.OPEN_ITEM_SQL, /IFNULL\(d\.fulfilled_qty, 0\) < d\.base_qty/);
    assert.match(rules.OPEN_ITEM_SQL, /d\.status IN \('Active', 'Close Requested'\)/);
    assert.doesNotMatch(rules.OPEN_ITEM_SQL, /Closed/);
    assert.match(rules.REMAINING_SQL, /GREATEST\(0, d\.base_qty - IFNULL\(d\.fulfilled_qty, 0\)\)/);
});

test('modul Outstanding PO memakai konstanta yang sama', () => {
    assert.equal(queryHelper.REMAINING_SQL, rules.REMAINING_SQL);
});

test('ringkasan PO Requirement memakai aturan bersama', async () => {
    queries.length = 0;
    nextRows = [[]];
    const res = fakeRes();
    await controller.getPORequirementSummary({ query: { start_week: '2026-W10', end_week: '2026-W12' } }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const sql = norm(queries[0].sql);
    assert.ok(sql.includes(norm(`SUM(${rules.REMAINING_SQL})`)));
    assert.ok(sql.includes(rules.NOT_DELETED_SQL));
    assert.ok(sql.includes(rules.APPROVED_HEADER_SQL));
    assert.ok(sql.includes(rules.OPEN_ITEM_SQL));
    assert.doesNotMatch(sql, /AND d\.fulfilled_qty < d\.base_qty/);
});

test('detail PO Requirement memakai aturan bersama dan urutan stabil', async () => {
    queries.length = 0;
    nextRows = [[{ id_product: 1, product_code: 'P1', product_name: 'N', base_uom: 'PCS' }], [], []];
    const res = fakeRes();
    await controller.getPORequirementDetail({ params: { id_product: '1' }, query: { start_week: '2026-W10', end_week: '2026-W12' } }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    const poSql = norm(queries.find((q) => /remaining_qty/.test(q.sql)).sql);
    assert.ok(poSql.includes(norm(`${rules.REMAINING_SQL} AS remaining_qty`)));
    assert.ok(poSql.includes(rules.OPEN_ITEM_SQL));
    assert.match(poSql, /ORDER BY h\.created_at ASC, h\.po_header_id ASC, d\.po_detail_id ASC/);
});
