'use strict';

/**
 * Aturan "harga jual yang berlaku hari ini" harus satu, dan dipakai oleh perhitungan harga PO,
 * daftar produk customer, dan penanda harga di PO Requirement. Database diganti tiruan yang mencatat SQL.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const queries = [];
let nextRows = [];
const fakeDb = {
    async query(sql, params) {
        queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
        return [nextRows.shift() || []];
    }
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    if (request.endsWith('/helpers/tokenHelper')) return { verifyToken() { throw new Error('tidak dipakai di tes'); } };
    return originalLoad.apply(this, arguments);
};

const { currentPriceCondition, hasCurrentPriceSql } = require('../helpers/po/currentPriceRules');
const { priceItems } = require('../helpers/poPricing');
const masterController = require('../controllers/masterController');
const requirement = require('../controllers/productionSchedule/poRequirement/poRequirementGetController');

const fakeRes = () => {
    const res = { statusCode: 200, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};

test('syarat harga berlaku: sudah mulai, dan belum berakhir atau tanpa akhir', () => {
    assert.equal(
        currentPriceCondition('sp'),
        'sp.start_date <= CURDATE() AND (sp.end_date IS NULL OR sp.end_date >= CURDATE())'
    );
    const exists = hasCurrentPriceSql('p').replace(/\s+/g, ' ');
    assert.match(exists, /^EXISTS \(SELECT 1 FROM sipuro_db\.product_selling_prices sp_now/);
    assert.match(exists, /sp_now\.id_product = p\.id_product/);
    assert.ok(exists.includes(currentPriceCondition('sp_now')));
});

test('perhitungan harga PO memakai syarat yang sama', async () => {
    queries.length = 0;
    nextRows = [
        [{ id_product: 1, product_name: 'P1', base_uom: 'PCS', pcs_per_ctn: 1, ctn_per_plt: 1, ml_per_pcs: null, kg_per_pcs: null, is_active: 1 }],
        [{ id_product: 1, price: '1000.00' }]
    ];
    await priceItems({ db: fakeDb, items: [{ id_product: 1, qty: 2 }], ppnPercent: 11 });
    const priceQuery = queries.find((q) => /product_selling_prices/.test(q.sql));
    assert.ok(priceQuery.sql.includes(currentPriceCondition('sp')));
    assert.deepEqual(priceQuery.params, [[1]]);
    assert.match(priceQuery.sql, /ORDER BY sp\.id_product ASC, sp\.start_date DESC, sp\.price_id DESC/);
});

test('daftar produk customer memakai syarat yang sama', async () => {
    queries.length = 0;
    nextRows = [[]];
    const res = fakeRes();
    await masterController.getProducts({ user: { type: 'CUSTOMER', customerId: 1 } }, res);
    assert.equal(res.statusCode, 200);
    assert.ok(queries[0].sql.includes(`p.is_active = 1 AND ${currentPriceCondition('sp')}`));
});

test('PO Requirement: has_active_price dihitung dari aturan bersama dan dikirim sebagai boolean', async () => {
    queries.length = 0;
    nextRows = [[
        { id_product: 1, product_code: 'A', product_name: 'With price', base_uom: 'PCS', po_outstanding_qty: '5', total_production_plan_qty: '2', has_active_price: 1 },
        { id_product: 2, product_code: 'B', product_name: 'No price', base_uom: 'PCS', po_outstanding_qty: '0', total_production_plan_qty: '0', has_active_price: 0 }
    ]];
    const res = fakeRes();
    await requirement.getPORequirementSummary({ query: { start_week: '2026-W10', end_week: '2026-W11' } }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.ok(queries[0].sql.includes(`${hasCurrentPriceSql('p').replace(/\s+/g, ' ')} AS has_active_price`));
    assert.deepEqual(res.body.data.map((r) => r.has_active_price), [true, false]);
});
