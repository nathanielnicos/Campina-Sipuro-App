'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/delivery-order/deliveryOrderTotals')) {
        return { fetchLotStock: async () => ({ allocated: new Map(), netDelivered: new Map() }) };
    }
    return originalLoad.apply(this, arguments);
};
const { loadProductionLotContext } = require('../services/production-lot/lotContextLoader');

const STORED = { batch_number: 'B1', lot_number: 'L1', item_code: 'P1', trans_type: 'WIP Completion', qty_pac: 50, completed: '2026-11-04 14:05:31', expired: '2028-11-03', doc_source: null };

const makeDb = () => {
    const calls = [];
    return {
        calls,
        query: async (sql, params) => {
            const s = sql.replace(/\s+/g, ' ').trim();
            calls.push({ s, params });
            if (/FROM products$/.test(s)) return [[{ id_product: 1, product_code: 'P1', product_name: 'x', is_active: 1 }]];
            if (/FROM production_lot_upload_details WHERE lot_number IN/.test(s)) return [[STORED]];
            return [[]];
        }
    };
};
const row = (lot) => ({ rowHash: 'h', itemCode: 'P1', lotNumber: lot, batchNumber: 'B1', matchBy: 'BATCH_LOT', rawAllocationQty: 5 });

test('loader: memuat baris upload tersimpan per lot di file untuk deteksi Data Changed', async () => {
    const db = makeDb();
    const { context } = await loadProductionLotContext(db, [row('L1'), row('L1'), row('L2')]);
    const q = db.calls.filter((c) => /FROM production_lot_upload_details WHERE lot_number IN/.test(c.s));
    assert.equal(q.length, 1);
    assert.deepEqual(q[0].params, [['L1', 'L2']]);
    assert.match(q[0].s, /DATE_FORMAT\(actual_completed_datetime, '%Y-%m-%d %H:%i:%s'\) AS completed/);
    assert.match(q[0].s, /DATE_FORMAT\(expired_date, '%Y-%m-%d'\) AS expired/);
    assert.deepEqual(context.existingDetailRows, [STORED]);
});

test('loader: lot kosong tidak diquery', async () => {
    const db = makeDb();
    const { context } = await loadProductionLotContext(db, [row('')]);
    assert.equal(db.calls.filter((c) => /FROM production_lot_upload_details WHERE lot_number IN/.test(c.s)).length, 0);
    assert.deepEqual(context.existingDetailRows, []);
});
