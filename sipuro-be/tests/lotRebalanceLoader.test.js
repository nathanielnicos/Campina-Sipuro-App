'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request === './lotContextLoader') return { fetchPoDetails: async (q, where, params) => { poCalls.push([where, params]); return where.startsWith('d.id_product') ? [{ po_detail_id: 1 }] : [{ po_detail_id: 9 }]; } };
    if (request === '../delivery-order/deliveryOrderTotals') return { fetchLotStock: async (q, nums, opts) => { stockCalls.push(nums); stockOpts.push(opts); return { delivered: new Map([['k', 9]]), netDelivered: new Map([['k', 5]]) }; } };
    return originalLoad.apply(this, arguments);
};
const poCalls = [];
const stockCalls = [];
const stockOpts = [];
const { loadRebalanceInput } = require(path.join('..', 'services/production-lot/lotRebalanceLoader'));
const { BusinessError } = require('../helpers/businessError');

const make = () => {
    const sqls = [];
    const q = async (sql) => {
        const t = sql.replace(/\s+/g, ' ').trim();
        sqls.push(t);
        if (/FROM products/.test(t)) return [[{ id_product: 1, product_code: 'P1' }, { id_product: 2, product_code: 'P2' }]];
        if (/FROM product_code_mappings/.test(t)) return [[{ id_product_old: 2, id_product_new: 1 }]];
        if (/FROM lots WHERE/.test(t)) return [[{ id: 10, lot_number: 'A', id_product: 1 }]];
        if (/FROM po_lot_allocations/.test(t)) return [[{ id: 100, po_detail_id: 9, lot_id: 10, id_batch: 20, allocated_qty: 60, status: 'Open' }]];
        if (/FROM batches WHERE id IN/.test(t)) return [[{ id: 20, batch_number: 'B1', id_product: 1 }]];
        if (/GROUP BY l.id, b.id/.test(t)) return [[{ lot_id: 10, batch_id: 20, net_qty: '60', first_completed: '2026-02-01 10:00:00' }]];
        if (/GROUP BY l.id$/.test(t)) return [[{ lot_id: 10, net_qty: '55' }]];
        if (/FROM po_lot_allocation_logs/.test(t)) return [[{ allocation_id: 100, delta: '-20' }, { allocation_id: 101, delta: '0' }]];
        return [[]];
    };
    return { q, sqls };
};

test('memuat keluarga kode, produksi bersih, tanggal selesai, edit manual dan qty terkirim', async () => {
    poCalls.length = 0; stockCalls.length = 0;
    const { q, sqls } = make();
    const r = await loadRebalanceInput({ query: q }, 1);
    assert.equal(r.productId, 1);
    assert.deepEqual(r.netByLotBatch, new Map([['10_20', 60]]));
    assert.deepEqual(r.netByLot, new Map([[10, 55]]));
    assert.deepEqual(r.firstCompleted, new Map([['10_20', '2026-02-01 10:00:00']]));
    assert.deepEqual(r.manualDeltas, new Map([[100, -20]]));
    assert.deepEqual(stockCalls[0], ['A']);
    // qty terkirim yang dipakai adalah terkirim BERSIH (terkirim 9, bersih 5), bukan terkirim bruto
    assert.equal(r.lotDelivered.get('k'), 5);
    // stok dipooling per keluarga produk: penentu kode kanonik diteruskan
    assert.equal(stockOpts[0].stockCodes.forProductCode('P2'), 'P1');
    assert.equal(r.stockCodes.forProductCode('P1'), 'P1');
    // item PO: keluarga produk, lalu PO yang memegang alokasi tetapi belum termuat
    assert.deepEqual(poCalls[0][1], [[1, 2]]);
    assert.deepEqual(r.openPoDetails.map((p) => p.po_detail_id), [1, 9]);
    assert.ok(sqls.every((s) => !/FOR UPDATE/.test(s)));
});

test('forUpdate mengunci item PO lalu alokasi', async () => {
    const { q, sqls } = make();
    await loadRebalanceInput({ query: q }, 1, { forUpdate: true });
    const poLock = sqls.findIndex((s) => /FROM po_details d/.test(s) && /FOR UPDATE/.test(s));
    const allocLock = sqls.findIndex((s) => /FROM po_lot_allocations/.test(s) && /FOR UPDATE/.test(s));
    assert.ok(poLock >= 0 && allocLock > poLock);
});

test('log edit manual: jenis manual/pembatalan, dan riwayat lama tanpa jenis', async () => {
    const { q, sqls } = make();
    await loadRebalanceInput({ query: q }, 1);
    const logSql = sqls.find((s) => /FROM po_lot_allocation_logs/.test(s));
    assert.match(logSql, /trans_type IN \(\?, \?\)/);
    assert.match(logSql, /trans_type IS NULL AND upload_log_id IS NULL AND new_allocated_qty <> old_allocated_qty/);
});

test('produk tidak ada -> 404', async () => {
    await assert.rejects(() => loadRebalanceInput({ query: async () => [[]] }, 1), (e) => e instanceof BusinessError && e.status === 404);
});
