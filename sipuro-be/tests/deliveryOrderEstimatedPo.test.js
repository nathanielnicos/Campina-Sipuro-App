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
