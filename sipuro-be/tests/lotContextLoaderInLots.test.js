'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request.endsWith('/delivery-order/deliveryOrderTotals')) {
        return { fetchLotStock: async () => ({ allocated: new Map(), delivered: new Map(), netDelivered: new Map() }) };
    }
    return originalLoad.apply(this, arguments);
};
const { loadProductionLotContext } = require('../services/production-lot/lotContextLoader');

const makeDb = () => {
    const sqls = [];
    return {
        sqls,
        query: async (sql) => {
            const s = sql.replace(/\s+/g, ' ').trim();
            sqls.push(s);
            if (/FROM products$/.test(s)) return [[{ id_product: 1, product_code: 'P1', product_name: 'x', is_active: 1 }]];
            if (/FROM lots WHERE/.test(s)) return [[{ id: 5, lot_number: 'L1', id_product: 1 }]];
            if (/FROM sipuro_db.po_lot_allocation_logs/.test(s)) return [[{ doc_source: 'D1', lot_id: 5, po_detail_id: 2, id_batch: 12, reduced_qty: '40', restored_qty: '0' }]];
            if (/SELECT DISTINCT l.id AS lot_id/.test(s)) return [[{ lot_id: 5, id_batch: 11, batch_number: 'B1' }]];
            if (/FROM po_lot_allocations/.test(s)) return [[{ id: 1, po_detail_id: 2, lot_id: 5, id_batch: 11, allocated_qty: 1, status: 'Open' }]];
            return [[]];
        }
    };
};
const row = (qty) => ({ rowHash: 'h', itemCode: 'P1', lotNumber: 'L1', batchNumber: '', matchBy: 'LOT', docSource: 'D1', rawAllocationQty: qty });
const count = (db, re) => db.sqls.filter((s) => re.test(s)).length;

test('loader: baris non-produksi arah OUT tidak memuat riwayat Doc Source maupun batch produksi lot', async () => {
    const db = makeDb();
    const { context } = await loadProductionLotContext(db, [row(-5)]);
    assert.equal(count(db, /po_lot_allocation_logs/), 0);
    assert.equal(count(db, /SELECT DISTINCT l.id AS lot_id/), 0);
    assert.deepEqual(context.docReductions, []);
    assert.deepEqual(context.lotBatches, []);
});

test('loader: baris non-produksi arah IN memuat pengurangan per Doc Source dan batch produksi lot', async () => {
    const db = makeDb();
    const { context } = await loadProductionLotContext(db, [row(5)]);
    assert.equal(count(db, /po_lot_allocation_logs/), 1);
    assert.equal(count(db, /SELECT DISTINCT l.id AS lot_id/), 1);
    assert.equal(context.docReductions.length, 1);
    assert.deepEqual(context.lotBatches, [{ lot_id: 5, id_batch: 11, batch_number: 'B1' }]);
});

test('loader: baris produksi (Batch + Lot) tidak memuat data tambahan IN', async () => {
    const db = makeDb();
    await loadProductionLotContext(db, [{ ...row(5), matchBy: 'BATCH_LOT', batchNumber: 'B1', docSource: '' }]);
    assert.equal(count(db, /po_lot_allocation_logs/), 0);
});
