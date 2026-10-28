'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadProductionLotContext } = require('../services/production-lot/lotContextLoader');

const PRODUCTS = [
    { id_product: 1, product_code: 'P1', product_name: 'Prod 1' },
    { id_product: 2, product_code: 'P2', product_name: 'Prod 2' },
    { id_product: 3, product_code: 'P3', product_name: 'Prod 3' }
];

const makeDb = (over = {}) => {
    const calls = [];
    const st = {
        mappings: [],
        lots: [],
        batches: [],
        allocations: [],
        poByProduct: (ids) => ids.map((id) => ({ po_detail_id: id * 10, id_product: id, product_code: `P${id}` })),
        poById: (ids) => ids.map((id) => ({ po_detail_id: id, id_product: 9, product_code: 'P9' })),
        ...over
    };
    return {
        calls,
        query: async (sql, params) => {
            const s = sql.replace(/\s+/g, ' ').trim();
            calls.push({ sql: s, params });
            // Query PO memuat subquery po_lot_allocations: cocokkan lebih dahulu
            if (/JOIN po_headers/.test(s)) {
                if (/AND d\.id_product IN/.test(s)) return [st.poByProduct(params[2])];
                if (/AND d\.po_detail_id IN/.test(s)) return [st.poById(params[2])];
            }
            if (/FROM products$/.test(s)) return [PRODUCTS];
            if (/FROM production_lot_upload_details/.test(s)) return [[]];
            if (/FROM product_code_mappings/.test(s)) return [st.mappings];
            if (/FROM batches/.test(s)) return [st.batches];
            if (/FROM lots/.test(s)) return [st.lots];
            if (/FROM po_lot_allocations/.test(s)) return [st.allocations];
            if (/^SELECT d\.po_detail_id FROM po_details d/.test(s)) return [[]];
            return [[]];
        }
    };
};
const row = (itemCode) => ({ batchNumber: 'B1', lotNumber: 'L1', itemCode, rowHash: `h-${itemCode}` });
const find = (db, re) => db.calls.filter((c) => re.test(c.sql));

test('tanpa pemetaan: hanya produk di file yang dimuat; pemetaan kosong diteruskan', async () => {
    const db = makeDb();
    const out = await loadProductionLotContext(db, [row('P1')]);
    assert.deepEqual(find(db, /AND d\.id_product IN/)[0].params[2], [1]);
    assert.deepEqual(out.openPoDetails.map((p) => p.id_product), [1]);
    assert.deepEqual(out.context.productMappings, []);
});

test('pemetaan: produk sekeluarga ikut dimuat (urut naik, tanpa ganda); produk lain tidak', async () => {
    const db = makeDb({ mappings: [{ id_product_old: 1, id_product_new: 2 }] });
    const out = await loadProductionLotContext(db, [row('P1'), row('P2'), row('P3')]);
    assert.deepEqual(find(db, /AND d\.id_product IN/)[0].params[2], [1, 2, 3]);

    const db2 = makeDb({ mappings: [{ id_product_old: 1, id_product_new: 2 }] });
    await loadProductionLotContext(db2, [row('P2')]);
    assert.deepEqual(find(db2, /AND d\.id_product IN/)[0].params[2], [1, 2]);
    assert.deepEqual(out.context.productMappings, [{ id_product_old: 1, id_product_new: 2 }]);
});

test('kunci baris (forUpdate) mencakup seluruh keluarga; tanpa forUpdate tidak ada FOR UPDATE', async () => {
    const locked = makeDb({ mappings: [{ id_product_old: 1, id_product_new: 2 }] });
    await loadProductionLotContext(locked, [row('P1')], { forUpdate: true });
    const lock = find(locked, /^SELECT d\.po_detail_id FROM po_details d WHERE d\.id_product IN/)[0];
    assert.deepEqual(lock.params[0], [1, 2]);
    assert.match(lock.sql, /ORDER BY d\.po_detail_id FOR UPDATE$/);

    const plain = makeDb({ mappings: [{ id_product_old: 1, id_product_new: 2 }] });
    await loadProductionLotContext(plain, [row('P1')]);
    assert.equal(plain.calls.filter((c) => /FOR UPDATE/.test(c.sql)).length, 0);
});

test('PO yang memegang alokasi lot di file tetapi di luar keluarga/produk file ikut dimuat (retur lintas kode)', async () => {
    const db = makeDb({
        lots: [{ id: 7 }],
        allocations: [{ id: 1, po_detail_id: 10, lot_id: 7 }, { id: 2, po_detail_id: 99, lot_id: 7 }]
    });
    const out = await loadProductionLotContext(db, [row('P1')]);
    assert.deepEqual(find(db, /AND d\.po_detail_id IN/)[0].params[2], [99]);
    assert.deepEqual(out.openPoDetails.map((p) => p.po_detail_id).sort((a, b) => a - b), [10, 99]);
});

test('PO tambahan dikunci berurutan sebelum dimuat saat forUpdate', async () => {
    const db = makeDb({ lots: [{ id: 7 }], allocations: [{ id: 2, po_detail_id: 99, lot_id: 7 }, { id: 3, po_detail_id: 50, lot_id: 7 }] });
    await loadProductionLotContext(db, [row('P1')], { forUpdate: true });
    const lockIdx = db.calls.findIndex((c) => /WHERE d\.po_detail_id IN \(\?\)/.test(c.sql) && /FOR UPDATE/.test(c.sql));
    const loadIdx = db.calls.findIndex((c) => /AND d\.po_detail_id IN \(\?\) ORDER BY h\.created_at/.test(c.sql));
    assert.ok(lockIdx >= 0 && loadIdx > lockIdx);
    assert.deepEqual(db.calls[lockIdx].params[0], [50, 99]);
});

test('tidak ada PO tambahan bila semua PO beralokasi sudah termuat; tanpa produk terdaftar tidak ada query PO', async () => {
    const db = makeDb({ lots: [{ id: 7 }], allocations: [{ id: 1, po_detail_id: 10, lot_id: 7 }] });
    await loadProductionLotContext(db, [row('P1')]);
    assert.equal(find(db, /AND d\.po_detail_id IN/).length, 0);

    const none = makeDb();
    const out = await loadProductionLotContext(none, [row('ZZ')]);
    assert.equal(find(none, /JOIN po_headers/).length, 0);
    assert.deepEqual(out.openPoDetails, []);
});

test('query PO memakai satu rumus qty teralokasi dan hanya status layak', async () => {
    const db = makeDb();
    await loadProductionLotContext(db, [row('P1')]);
    const q = find(db, /JOIN po_headers/)[0];
    assert.match(q.sql, /SUM\(pla\.allocated_qty\)/);
    assert.match(q.sql, /h\.status IN \(\?\)/);
    assert.match(q.sql, /d\.status IN \(\?\)/);
    assert.deepEqual(q.params[0], ['Approved', 'Production Completed']);
    assert.deepEqual(q.params[1], ['Active', 'Close Requested']);
});
