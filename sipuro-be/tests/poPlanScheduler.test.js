'use strict';

/**
 * Scheduler mingguan PO vs Production Plan harus memakai definisi outstanding yang sama
 * dengan menu Outstanding PO dan PO Requirement (helpers/po/openItemRules.js).
 * Database, cron, dan notifikasi diganti tiruan.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const queries = [];
let nextRows = [];
const notifications = [];

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request === 'node-cron') return { schedule() {} };
    if (request.endsWith('/config/db')) {
        return { sipuroDb: { async query(sql, params) { queries.push({ sql: sql.replace(/\s+/g, ' '), params }); return [nextRows]; } } };
    }
    if (request.endsWith('/helpers/notificationHelper')) {
        return { createNotification: async (n) => { notifications.push(n); } };
    }
    return originalLoad.apply(this, arguments);
};

const rules = require('../helpers/po/openItemRules');
const { checkPoVsProductionPlan } = require('../jobs/poPlanScheduler');

const norm = (s) => s.replace(/\s+/g, ' ');

test('query scheduler memakai aturan item terbuka bersama, bukan fulfilled_qty mentah', async () => {
    queries.length = 0; notifications.length = 0; nextRows = [];
    await checkPoVsProductionPlan();
    const sql = queries[0].sql;
    assert.ok(sql.includes(norm(`SUM(${rules.REMAINING_SQL})`)));
    assert.ok(sql.includes(rules.NOT_DELETED_SQL));
    assert.ok(sql.includes(rules.APPROVED_HEADER_SQL));
    assert.ok(sql.includes(rules.OPEN_ITEM_SQL));
    assert.doesNotMatch(sql, /AND d\.fulfilled_qty < d\.base_qty/);
    assert.doesNotMatch(sql, /d\.base_qty - d\.fulfilled_qty/);
    assert.doesNotMatch(sql, /h_inner/);
});

test('produk tanpa plan atau defisit menghasilkan satu notifikasi per customer', async () => {
    queries.length = 0; notifications.length = 0;
    nextRows = [
        { customer_id: 3, product_code: 'A', product_name: 'Alpha', po_outstanding_qty: '100', total_production_plan_qty: '0' },
        { customer_id: 3, product_code: 'B', product_name: 'Beta', po_outstanding_qty: '100', total_production_plan_qty: '60' },
        { customer_id: 3, product_code: 'C', product_name: 'Gamma', po_outstanding_qty: '50', total_production_plan_qty: '50' },
        { customer_id: 4, product_code: 'D', product_name: 'Delta', po_outstanding_qty: '10', total_production_plan_qty: '20' }
    ];
    const result = await checkPoVsProductionPlan();
    assert.equal(result.totalCustomersNotified, 1);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].recipientId, 3);
    assert.match(notifications[0].title, /2 Product/);
    assert.match(notifications[0].htmlMessage, /NO PLAN/);
    assert.match(notifications[0].htmlMessage, /DEFICIT/);
});
