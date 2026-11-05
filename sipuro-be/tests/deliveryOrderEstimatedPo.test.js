'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseEstimatedPoRequest, estimateLines, shapeEstimate, fetchEstimatedPo
} = require('../services/delivery-order/deliveryOrderEstimatedPo');
const { buildStockCodeResolver } = require('../services/product-code-mapping/stockFamilyKey');

const PRODUCTS = [
    { id_product: 1, product_code: '00045' },
    { id_product: 2, product_code: '00047' },
    { id_product: 3, product_code: '00099' }
];
const MAPPINGS = [{ id_product_old: 1, id_product_new: 2 }];
const codes = buildStockCodeResolver(PRODUCTS, MAPPINGS);
const none = buildStockCodeResolver(PRODUCTS, []);

const alloc = (poId, over = {}) => ({
    po_detail_id: poId, po_number: `PO${poId}`, po_created_at: `2026-07-0${poId} 08:00:00`,
    po_product_code: '00047', lot_product_code: '00047', lot_number: 'L1', total_qty: 100, ...over
});
let seq = 0;
const line = (doId, over = {}) => {
    seq += 1;
    return {
        id: seq, delivery_order_id: doId, do_number: `D${doId}`, do_datetime: `2026-07-1${doId} 10:00:00`,
        id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: 40, ...over
    };
};
const segs = (est, l) => est.get(l.id).segments.map((s) => [s.po_number, s.qty_pcs]);

test('parse: doIds valid, unik, dan ditolak bila kosong / bukan angka / terlalu banyak', () => {
    assert.deepEqual(parseEstimatedPoRequest({ doIds: '3, 1,3' }).doIds, [3, 1]);
    for (const bad of [undefined, '', 'a', '1,-2', '0', '1.5']) {
        assert.throws(() => parseEstimatedPoRequest({ doIds: bad }), (e) => e.status === 400, String(bad));
    }
    const many = Array.from({ length: 101 }, (_, i) => i + 1).join(',');
    assert.throws(() => parseEstimatedPoRequest({ doIds: many }), (e) => e.status === 400);
});

test('FIFO: DO tertua mengambil PO tertua; satu DO bisa memuat beberapa PO', () => {
    const a = line(1, { qty_pcs: 130 });
    const b = line(2, { qty_pcs: 50 });
    const est = estimateLines({ allocations: [alloc(2), alloc(1)], lines: [b, a], stockCodes: none });
    assert.deepEqual(segs(est, a), [['PO1', 100], ['PO2', 30]]);
    assert.deepEqual(segs(est, b), [['PO2', 50]]);
    assert.equal(est.get(a.id).unassignedQty, 0);
});

test('melebihi total alokasi: sisa dicatat sebagai unassigned', () => {
    const a = line(1, { qty_pcs: 130 });
    const est = estimateLines({ allocations: [alloc(1)], lines: [a], stockCodes: none });
    assert.deepEqual(segs(est, a), [['PO1', 100]]);
    assert.equal(est.get(a.id).unassignedQty, 30);
});

test('kasus 45/47: satu antrean per keluarga; alokasi lot kode 45 dan 47 digabung, via_mapping bila kode PO beda', () => {
    const allocations = [
        alloc(1, { po_product_code: '00045', lot_product_code: '00045', total_qty: 725 }),
        alloc(2, { po_product_code: '00047', lot_product_code: '00047', total_qty: 15680 })
    ];
    const a = line(1, { id_product: 2, product_code: '00047', qty_pcs: 800 });
    const est = estimateLines({ allocations, lines: [a], stockCodes: codes });
    assert.deepEqual(est.get(a.id).segments.map((s) => [s.po_number, s.qty_pcs, s.via_mapping]), [['PO1', 725, true], ['PO2', 75, false]]);
    // tanpa pemetaan: dua antrean terpisah, baris kode 47 tidak melihat alokasi kode 45
    const split = estimateLines({ allocations, lines: [a], stockCodes: none });
    assert.deepEqual(segs(split, a), [['PO2', 800]]);
});

test('lot berbeda dan produk tidak sekeluarga tidak saling mengambil', () => {
    const allocations = [alloc(1), alloc(2, { lot_number: 'L2', lot_product_code: '00099', po_product_code: '00099' })];
    const a = line(1, { lot_number: 'L2', qty_pcs: 10 });
    const est = estimateLines({ allocations, lines: [a], stockCodes: codes });
    assert.equal(est.get(a.id).segments.length, 0);
    assert.equal(est.get(a.id).unassignedQty, 10);
});

test('beberapa baris alokasi PO yang sama (beda batch) dijumlahkan', () => {
    const a = line(1, { qty_pcs: 150 });
    const est = estimateLines({ allocations: [alloc(1, { total_qty: 60 }), alloc(1, { total_qty: 60 })], lines: [a], stockCodes: none });
    assert.deepEqual(segs(est, a), [['PO1', 120]]);
    assert.equal(est.get(a.id).unassignedQty, 30);
});

test('DO yang tidak diminta tetap mengonsumsi antrean; hasil hanya untuk DO yang diminta', () => {
    const early = line(1, { qty_pcs: 100 });
    const late = line(2, { qty_pcs: 40 });
    const lines = [early, late];
    const est = estimateLines({ allocations: [alloc(1), alloc(2)], lines, stockCodes: none });
    const out = shapeEstimate([2], lines, est);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].items[0].pos.map((p) => [p.po_number, p.qty_pcs]), [['PO2', 40]]);
});

test('shapeEstimate: DO -> item -> lot, qty per PO digabung pada tingkat item', () => {
    const l1 = line(1, { lot_number: 'L1', qty_pcs: 100 });
    const l2 = line(1, { lot_number: 'L2', qty_pcs: 30 });
    const allocations = [alloc(1), alloc(1, { lot_number: 'L2' })];
    const est = estimateLines({ allocations, lines: [l1, l2], stockCodes: none });
    const [order] = shapeEstimate([1], [l1, l2], est);
    const item = order.items[0];
    assert.deepEqual(item.lots.map((l) => [l.lot_number, l.pos.map((p) => p.qty_pcs)]), [['L1', [100]], ['L2', [30]]]);
    assert.deepEqual(item.pos.map((p) => [p.po_number, p.qty_pcs]), [['PO1', 130]]);
    assert.equal(item.unassigned_qty, 0);
});

test('fetchEstimatedPo: alur query dan hasil', async () => {
    const log = [];
    const db = {
        query: async (sql) => {
            const text = sql.replace(/\s+/g, ' ').trim();
            log.push(text);
            if (/SELECT DISTINCT lot_number FROM delivery_order_lots/.test(text)) return [[{ lot_number: 'L1' }]];
            if (/FROM products$/.test(text)) return [PRODUCTS];
            if (/FROM product_code_mappings/.test(text)) return [MAPPINGS.map((m) => ({ ...m }))];
            if (/FROM po_lot_allocations pla/.test(text)) return [[alloc(1, { total_qty: '60', po_product_code: '00045', lot_product_code: '00045' }), alloc(2, { total_qty: '60' })]];
            if (/FROM delivery_order_lots dol/.test(text)) return [[{ id: 1, delivery_order_id: 7, do_number: 'D7', do_datetime: '2026-07-10 10:00:00', id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: '100' }]];
            return [[]];
        }
    };
    const out = await fetchEstimatedPo(db, [7]);
    assert.deepEqual(out[0].items[0].pos.map((p) => [p.po_number, p.qty_pcs, p.via_mapping]), [['PO1', 60, true], ['PO2', 40, false]]);
    const allocSql = log.find((t) => /FROM po_lot_allocations pla/.test(t));
    assert.match(allocSql, /pla\.status <> 'Canceled'/);
    assert.match(allocSql, /d\.deleted_at IS NULL/);
    // tanpa lot: tidak ada query lanjutan
    const empty = await fetchEstimatedPo({ query: async () => [[]] }, [9]);
    assert.deepEqual(empty, []);
});

test('retur penuh: DO tertua tidak diperkirakan, PO muncul di DO yang baru', () => {
    const a = line(1, { qty_pcs: 100 });
    const b = line(2, { qty_pcs: 100 });
    const returns = [{ product_code: '00047', lot_number: 'L1', total_qty: 100 }];
    const est = estimateLines({ allocations: [alloc(1)], lines: [a, b], returns, stockCodes: none });
    assert.deepEqual(segs(est, a), []);
    assert.equal(est.get(a.id).unassignedQty, 0);
    assert.equal(est.get(a.id).returnedQty, 100);
    assert.deepEqual(segs(est, b), [['PO1', 100]]);
    assert.equal(est.get(b.id).unassignedQty, 0);
});

test('retur sebagian: hanya sisa qty DO tertua yang diperkirakan, antrean yang dibebaskan dipakai DO berikutnya', () => {
    const a = line(1, { qty_pcs: 100 });
    const b = line(2, { qty_pcs: 50 });
    const returns = [{ product_code: '00047', lot_number: 'L1', total_qty: 30 }];
    const est = estimateLines({ allocations: [alloc(1), alloc(2)], lines: [a, b], returns, stockCodes: none });
    assert.deepEqual(segs(est, a), [['PO1', 70]]);
    assert.equal(est.get(a.id).returnedQty, 30);
    assert.deepEqual(segs(est, b), [['PO1', 30], ['PO2', 20]]);
});

test('retur melebihi satu DO mengalir ke DO tertua berikutnya; lot dan keluarga lain tidak terpengaruh', () => {
    const a = line(1, { qty_pcs: 40 });
    const b = line(2, { qty_pcs: 40 });
    const other = line(3, { lot_number: 'L2', qty_pcs: 40 });
    const returns = [{ product_code: '00045', lot_number: 'L1', total_qty: 60 }]; // kode lama, satu keluarga dengan 00047
    const allocations = [alloc(1, { total_qty: 200 }), alloc(2, { lot_number: 'L2', total_qty: 200 })];
    const est = estimateLines({ allocations, lines: [a, b, other], returns, stockCodes: codes });
    assert.equal(est.get(a.id).returnedQty, 40);
    assert.equal(est.get(b.id).returnedQty, 20);
    assert.deepEqual(segs(est, b), [['PO1', 20]]);
    assert.equal(est.get(other.id).returnedQty, 0);
    assert.deepEqual(segs(est, other), [['PO2', 40]]);
});

test('tanpa retur hasil sama seperti sebelumnya dan returned_qty = 0; shapeEstimate membawa returned_qty', () => {
    const a = line(1, { qty_pcs: 100 });
    const b = line(2, { qty_pcs: 40 });
    const lines = [a, b];
    const none0 = estimateLines({ allocations: [alloc(1)], lines, stockCodes: none });
    assert.equal(none0.get(a.id).returnedQty, 0);
    const est = estimateLines({ allocations: [alloc(1)], lines, returns: [{ product_code: '00047', lot_number: 'L1', total_qty: 100 }], stockCodes: none });
    const [first] = shapeEstimate([1], lines, est);
    assert.equal(first.items[0].returned_qty, 100);
    assert.equal(first.items[0].lots[0].returned_qty, 100);
    assert.deepEqual(first.items[0].pos, []);
    assert.equal(first.items[0].unassigned_qty, 0);
});

test('fetchEstimatedPo: total retur dibaca per kode produk dan lot, lalu dipakai perkiraan', async () => {
    const db = {
        query: async (sql) => {
            const text = sql.replace(/\s+/g, ' ').trim();
            if (/SELECT DISTINCT lot_number FROM delivery_order_lots/.test(text)) return [[{ lot_number: 'L1' }]];
            if (/FROM products$/.test(text)) return [PRODUCTS];
            if (/FROM product_code_mappings/.test(text)) return [[]];
            if (/FROM po_lot_allocations pla/.test(text)) return [[alloc(1, { total_qty: '100' })]];
            if (/FROM delivery_returns r/.test(text)) { assert.match(text, /GROUP BY p\.product_code, r\.lot_number/); return [[{ product_code: '00047', lot_number: 'L1', total_qty: '100' }]]; }
            if (/FROM delivery_order_lots dol/.test(text)) return [[
                { id: 1, delivery_order_id: 7, do_number: 'D7', do_datetime: '2026-07-10 10:00:00', id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: '100' },
                { id: 2, delivery_order_id: 8, do_number: 'D8', do_datetime: '2026-07-20 10:00:00', id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: '100' }
            ]];
            return [[]];
        }
    };
    const out = await fetchEstimatedPo(db, [7, 8]);
    assert.deepEqual(out[0].items[0].pos, []);
    assert.deepEqual(out[1].items[0].pos.map((p) => [p.po_number, p.qty_pcs]), [['PO1', 100]]);
});
