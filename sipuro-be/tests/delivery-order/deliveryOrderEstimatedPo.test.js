'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    RETURN_MATCH, DEFAULT_RETURN_MATCH, parseEstimatedPoRequest, parseEstimatedReturnRequest,
    simulateLots, checkEstimateIntegrity, shapeEstimate, shapeReturnEstimate, fetchEstimatedPo, fetchEstimatedReturnPo
} = require('../../services/delivery-order/deliveryOrderEstimatedPo');
const { buildStockCodeResolver } = require('../../services/product-code-mapping/stockFamilyKey');

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
// DO: doId menentukan nomor dan waktu (hari ke-10+doId) kecuali ditimpa
const line = (doId, over = {}) => {
    seq += 1;
    return {
        id: seq, delivery_order_id: doId, do_number: `D${doId}`, do_datetime: `2026-07-${10 + doId} 10:00:00`,
        id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: 40, ...over
    };
};
// Retur: n menentukan nomor; day = hari bulan Juli
const ret = (n, day, over = {}) => {
    seq += 1;
    return {
        id: seq, return_number: `R${n}`, return_datetime: `2026-07-${String(day).padStart(2, '0')} 12:00:00`,
        id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: 40, ...over
    };
};
const run = (input) => {
    const full = { stockCodes: none, allocations: [], lines: [], returnLines: [], ...input };
    const result = simulateLots(full);
    assert.deepEqual(checkEstimateIntegrity(full, result), [], 'keutuhan qty');
    return result;
};
const segs = (r, l) => r.doResults.get(l.id).segments.map((s) => [s.entry.poNumber, s.qty, s.returned]);
const rel = (r, x) => r.returnResults.get(x.id).releases.map((e) => [e.entry.poNumber, e.qty, e.doNumber]);

test('parse doIds: valid, unik, dan ditolak bila kosong / bukan angka / terlalu banyak', () => {
    assert.deepEqual(parseEstimatedPoRequest({ doIds: '3, 1,3' }).doIds, [3, 1]);
    for (const bad of [undefined, '', 'a', '1,-2', '0', '1.5']) {
        assert.throws(() => parseEstimatedPoRequest({ doIds: bad }), (e) => e.status === 400, String(bad));
    }
    const many = Array.from({ length: 101 }, (_, i) => i + 1).join(',');
    assert.throws(() => parseEstimatedPoRequest({ doIds: many }), (e) => e.status === 400);
});

test('parse returnNumbers: teks unik, ditolak bila kosong / terlalu banyak / terlalu panjang', () => {
    assert.deepEqual(parseEstimatedReturnRequest({ returnNumbers: '1200004773, 1200004774,1200004773' }).returnNumbers, ['1200004773', '1200004774']);
    assert.deepEqual(parseEstimatedReturnRequest({ returnNumbers: ['A1', 'B2'] }).returnNumbers, ['A1', 'B2']);
    for (const bad of [undefined, '', ' , ']) {
        assert.throws(() => parseEstimatedReturnRequest({ returnNumbers: bad }), (e) => e.status === 400, String(bad));
    }
    const many = Array.from({ length: 101 }, (_, i) => `R${i}`).join(',');
    assert.throws(() => parseEstimatedReturnRequest({ returnNumbers: many }), (e) => e.status === 400);
    assert.throws(() => parseEstimatedReturnRequest({ returnNumbers: 'x'.repeat(65) }), (e) => e.status === 400);
});

test('aturan bawaan: retur dicocokkan ke DO terbaru lebih dulu', () => {
    assert.equal(DEFAULT_RETURN_MATCH, RETURN_MATCH.LATEST_FIRST);
});

// ---------- FIFO tanpa retur ----------

test('FIFO: DO tertua mengambil PO tertua; satu DO bisa memuat beberapa PO', () => {
    const a = line(1, { qty_pcs: 130 });
    const b = line(2, { qty_pcs: 50 });
    const r = run({ allocations: [alloc(2), alloc(1)], lines: [b, a] });
    assert.deepEqual(segs(r, a), [['PO1', 100, 0], ['PO2', 30, 0]]);
    assert.deepEqual(segs(r, b), [['PO2', 50, 0]]);
    assert.equal(r.doResults.get(a.id).unassignedQty, 0);
});

test('melebihi total alokasi: sisa dicatat sebagai unassigned', () => {
    const a = line(1, { qty_pcs: 130 });
    const r = run({ allocations: [alloc(1)], lines: [a] });
    assert.deepEqual(segs(r, a), [['PO1', 100, 0]]);
    assert.equal(r.doResults.get(a.id).unassignedQty, 30);
});

test('kasus 45/47: satu antrean per keluarga; via_mapping bila kode PO beda dari kode DO', () => {
    const allocations = [
        alloc(1, { po_product_code: '00045', lot_product_code: '00045', total_qty: 725 }),
        alloc(2, { po_product_code: '00047', lot_product_code: '00047', total_qty: 15680 })
    ];
    const a = line(1, { id_product: 2, product_code: '00047', qty_pcs: 800 });
    const r = run({ allocations, lines: [a], stockCodes: codes });
    assert.deepEqual(segs(r, a), [['PO1', 725, 0], ['PO2', 75, 0]]);
    const [order] = shapeEstimate([1], [a], r.doResults);
    assert.deepEqual(order.items[0].pos.map((p) => [p.po_number, p.qty_pcs, p.via_mapping]), [['PO1', 725, true], ['PO2', 75, false]]);
    // tanpa pemetaan: dua antrean terpisah, baris kode 47 tidak melihat alokasi kode 45
    const split = run({ allocations, lines: [a], stockCodes: none });
    assert.deepEqual(segs(split, a), [['PO2', 800, 0]]);
});

test('lot berbeda dan produk tidak sekeluarga tidak saling mengambil', () => {
    const allocations = [alloc(1), alloc(2, { lot_number: 'L2', lot_product_code: '00099', po_product_code: '00099' })];
    const a = line(1, { lot_number: 'L2', qty_pcs: 10 });
    const r = run({ allocations, lines: [a], stockCodes: codes });
    assert.equal(r.doResults.get(a.id).segments.length, 0);
    assert.equal(r.doResults.get(a.id).unassignedQty, 10);
});

test('beberapa baris alokasi PO yang sama (beda batch) dijumlahkan', () => {
    const a = line(1, { qty_pcs: 150 });
    const r = run({ allocations: [alloc(1, { total_qty: 60 }), alloc(1, { total_qty: 60 })], lines: [a] });
    assert.deepEqual(segs(r, a), [['PO1', 120, 0]]);
    assert.equal(r.doResults.get(a.id).unassignedQty, 30);
});

test('DO yang tidak diminta tetap mengonsumsi antrean; hasil hanya untuk DO yang diminta', () => {
    const early = line(1, { qty_pcs: 100 });
    const late = line(2, { qty_pcs: 40 });
    const lines = [early, late];
    const r = run({ allocations: [alloc(1), alloc(2)], lines });
    const out = shapeEstimate([2], lines, r.doResults);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].items[0].pos.map((p) => [p.po_number, p.qty_pcs]), [['PO2', 40]]);
});

test('shapeEstimate: DO -> item -> lot, qty per PO digabung pada tingkat item', () => {
    const l1 = line(1, { lot_number: 'L1', qty_pcs: 100 });
    const l2 = line(1, { lot_number: 'L2', qty_pcs: 30 });
    const r = run({ allocations: [alloc(1), alloc(1, { lot_number: 'L2' })], lines: [l1, l2] });
    const [order] = shapeEstimate([1], [l1, l2], r.doResults);
    const item = order.items[0];
    assert.deepEqual(item.lots.map((l) => [l.lot_number, l.pos.map((p) => p.qty_pcs)]), [['L1', [100]], ['L2', [30]]]);
    assert.deepEqual(item.pos.map((p) => [p.po_number, p.qty_pcs, p.returned_pcs]), [['PO1', 130, 0]]);
    assert.equal(item.unassigned_qty, 0);
    assert.equal(item.returned_qty, 0);
    assert.ok(item.pos.every((p) => !('from' in p)), 'DO tidak membawa field from');
});

// ---------- Retur ----------

test('kirim ulang setelah retur penuh: DO lama tetap menunjuk PO-nya (dengan retur), DO baru memakai PO yang terbuka lagi', () => {
    const d1 = line(1, { qty_pcs: 100 });                 // 11 Jul
    const x = ret(1, 14, { qty_pcs: 100 });               // 14 Jul
    const d2 = line(5, { qty_pcs: 100 });                 // 15 Jul
    const r = run({ allocations: [alloc(1), alloc(2)], lines: [d1, d2], returnLines: [x] });
    assert.deepEqual(segs(r, d1), [['PO1', 100, 100]]);   // PO1, diretur seluruhnya
    assert.deepEqual(rel(r, x), [['PO1', 100, 'D1']]);
    assert.deepEqual(segs(r, d2), [['PO1', 100, 0]]);     // PO1 terbuka lagi, bukan PO2
    assert.equal(r.returnResults.get(x.id).unmatchedQty, 0);

    const [do1, do2] = shapeEstimate([1, 5], [d1, d2], r.doResults);
    assert.deepEqual(do1.items[0].pos.map((p) => [p.po_number, p.qty_pcs, p.returned_pcs]), [['PO1', 100, 100]]);
    assert.equal(do1.items[0].returned_qty, 100);
    assert.deepEqual(do2.items[0].pos.map((p) => [p.po_number, p.qty_pcs, p.returned_pcs]), [['PO1', 100, 0]]);
    // PO1 dialokasikan 100: kirim 200, retur 100 -> bersih 100 (tidak ganda)
    const net = [...do1.items[0].pos, ...do2.items[0].pos].reduce((s, p) => s + p.qty_pcs - p.returned_pcs, 0);
    assert.equal(net, 100);
});

test('retur dicocokkan ke DO terbaru; DO lama di tengah-tengah tidak tersenggol', () => {
    const d1 = line(1, { qty_pcs: 100 });                 // PO1 100
    const d2 = line(2, { qty_pcs: 50 });                  // PO2 50
    const x = ret(1, 20, { qty_pcs: 30 });
    const r = run({ allocations: [alloc(1), alloc(2)], lines: [d1, d2], returnLines: [x] });
    assert.deepEqual(segs(r, d1), [['PO1', 100, 0]]);
    assert.deepEqual(segs(r, d2), [['PO2', 50, 30]]);
    assert.deepEqual(rel(r, x), [['PO2', 30, 'D2']]);
});

test('retur lebih besar dari DO terbaru mengalir ke DO sebelumnya (terbaru dulu)', () => {
    const d1 = line(1, { qty_pcs: 100 });
    const d2 = line(2, { qty_pcs: 40 });
    const x = ret(1, 20, { qty_pcs: 60 });
    const r = run({ allocations: [alloc(1, { total_qty: 200 })], lines: [d1, d2], returnLines: [x] });
    assert.deepEqual(rel(r, x), [['PO1', 40, 'D2'], ['PO1', 20, 'D1']]);
    assert.equal(r.doResults.get(d2.id).returned, 40);
    assert.equal(r.doResults.get(d1.id).returned, 20);
    const [shaped] = shapeReturnEstimate(['R1'], [x], r.returnResults);
    assert.deepEqual(shaped.items[0].pos.map((p) => [p.po_number, p.qty_pcs, p.from.map((f) => [f.do_number, f.qty_pcs])]), [['PO1', 60, [['D2', 40], ['D1', 20]]]]);
});

test('aturan OLDEST_FIRST (opsi): retur memotong DO tertua dulu', () => {
    const d1 = line(1, { qty_pcs: 100 });
    const d2 = line(2, { qty_pcs: 40 });
    const x = ret(1, 20, { qty_pcs: 60 });
    const r = run({ allocations: [alloc(1, { total_qty: 200 })], lines: [d1, d2], returnLines: [x], returnMatch: RETURN_MATCH.OLDEST_FIRST });
    assert.deepEqual(rel(r, x), [['PO1', 60, 'D1']]);
    assert.equal(r.doResults.get(d2.id).returned, 0);
});

test('retur hanya cocok ke DO yang terjadi sebelumnya; kelebihannya unmatched, DO sesudahnya tidak tersenggol', () => {
    const d1 = line(1, { qty_pcs: 30 });                  // 11 Jul
    const x = ret(1, 12, { qty_pcs: 50 });                // 12 Jul
    const d2 = line(5, { qty_pcs: 100 });                 // 15 Jul
    const r = run({ allocations: [alloc(1, { total_qty: 500 })], lines: [d1, d2], returnLines: [x] });
    assert.equal(r.returnResults.get(x.id).unmatchedQty, 20);
    assert.deepEqual(rel(r, x), [['PO1', 30, 'D1']]);
    assert.equal(r.doResults.get(d2.id).returned, 0);
    const [shaped] = shapeReturnEstimate(['R1'], [x], r.returnResults);
    assert.equal(shaped.items[0].unmatched_qty, 20);
});

test('retur tanpa pengiriman sebelumnya: seluruhnya unmatched', () => {
    const x = ret(1, 5, { qty_pcs: 70 });
    const d1 = line(1, { qty_pcs: 40 });                  // 11 Jul, setelah retur
    const r = run({ allocations: [alloc(1)], lines: [d1], returnLines: [x] });
    assert.equal(r.returnResults.get(x.id).unmatchedQty, 70);
    assert.deepEqual(r.returnResults.get(x.id).releases, []);
    assert.deepEqual(segs(r, d1), [['PO1', 40, 0]]);
});

test('waktu sama: DO dulu baru retur (retur boleh cocok ke DO pada waktu yang sama)', () => {
    const d1 = line(1, { qty_pcs: 40, do_datetime: '2026-07-20 12:00:00' });
    const x = ret(1, 20, { qty_pcs: 40 });                // 20 Jul 12:00:00
    const r = run({ allocations: [alloc(1)], lines: [d1], returnLines: [x] });
    assert.equal(r.returnResults.get(x.id).unmatchedQty, 0);
    assert.deepEqual(rel(r, x), [['PO1', 40, 'D1']]);
});

test('retur sebagian dari DO yang memuat dua PO: segmen terakhir dilepas dulu; pengiriman berikutnya mengisi PO tertua yang terbuka', () => {
    const d1 = line(1, { qty_pcs: 130 });                 // PO1 100 + PO2 30
    const x = ret(1, 14, { qty_pcs: 40 });                // melepas PO2 30 lalu PO1 10
    const d2 = line(5, { qty_pcs: 60 });                  // mengisi PO1 10 lalu PO2 50
    const r = run({ allocations: [alloc(1), alloc(2)], lines: [d1, d2], returnLines: [x] });
    assert.deepEqual(segs(r, d1), [['PO1', 100, 10], ['PO2', 30, 30]]);
    assert.deepEqual(rel(r, x), [['PO2', 30, 'D1'], ['PO1', 10, 'D1']]);
    assert.deepEqual(segs(r, d2), [['PO1', 10, 0], ['PO2', 50, 0]]);
});

test('bagian DO yang tidak tertutup alokasi dilepas lebih dulu oleh retur', () => {
    const d1 = line(1, { qty_pcs: 130 });                 // PO1 100 + unassigned 30
    const x = ret(1, 14, { qty_pcs: 30 });
    const r = run({ allocations: [alloc(1)], lines: [d1], returnLines: [x] });
    assert.equal(r.doResults.get(d1.id).unassignedQty, 30);
    assert.equal(r.doResults.get(d1.id).unassignedReturned, 30);
    assert.deepEqual(rel(r, x), []);
    assert.equal(r.returnResults.get(x.id).unassignedReleased, 30);
    assert.deepEqual(segs(r, d1), [['PO1', 100, 0]]);
    const [order] = shapeEstimate([1], [d1], r.doResults);
    assert.equal(order.items[0].unassigned_qty, 0);       // sudah tidak ada sisa tak terhubung
    assert.equal(order.items[0].returned_qty, 30);
    const [shaped] = shapeReturnEstimate(['R1'], [x], r.returnResults);
    assert.equal(shaped.items[0].unassigned_released_qty, 30);
    assert.equal(shaped.items[0].unmatched_qty, 0);
});

test('retur satu keluarga produk: kode lama dan baru berbagi DO dan antrean', () => {
    const d1 = line(1, { id_product: 2, product_code: '00047', qty_pcs: 50 });
    const x = ret(1, 14, { id_product: 1, product_code: '00045', qty_pcs: 20 });
    const allocations = [alloc(1, { po_product_code: '00045', lot_product_code: '00045', total_qty: 100 })];
    const r = run({ allocations, lines: [d1], returnLines: [x], stockCodes: codes });
    assert.deepEqual(rel(r, x), [['PO1', 20, 'D1']]);
    const [shaped] = shapeReturnEstimate(['R1'], [x], r.returnResults);
    assert.equal(shaped.items[0].id_product, 1);
    assert.equal(shaped.items[0].pos[0].via_mapping, false);   // kode PO 00045 = kode retur 00045
});

test('lot berbeda tidak saling mencocokkan retur', () => {
    const d1 = line(1, { lot_number: 'L1', qty_pcs: 40 });
    const x = ret(1, 14, { lot_number: 'L2', qty_pcs: 40 });
    const r = run({ allocations: [alloc(1), alloc(2, { lot_number: 'L2' })], lines: [d1], returnLines: [x] });
    assert.equal(r.returnResults.get(x.id).unmatchedQty, 40);
    assert.equal(r.doResults.get(d1.id).returned, 0);
});

test('shapeReturnEstimate: retur -> item -> lot, PO digabung dengan daftar DO asal; nomor retur yang tidak diminta dilewati', () => {
    const d1 = line(1, { qty_pcs: 100 });
    const d2 = line(2, { qty_pcs: 100 });
    const x1 = ret(1, 20, { qty_pcs: 30 });
    const x2 = ret(2, 21, { qty_pcs: 20, lot_number: 'L9' });
    const r = run({ allocations: [alloc(1, { total_qty: 200 })], lines: [d1, d2], returnLines: [x1, x2] });
    const out = shapeReturnEstimate(['R2', 'R1', 'R404'], [x1, x2], r.returnResults);
    assert.deepEqual(out.map((o) => o.return_number), ['R2', 'R1']);
    assert.equal(out[0].items[0].unmatched_qty, 20);
    assert.deepEqual(out[0].items[0].pos, []);
    assert.deepEqual(out[1].items[0].pos.map((p) => [p.po_number, p.qty_pcs, p.from]), [['PO1', 30, [{ do_number: 'D2', qty_pcs: 30 }]]]);
    assert.deepEqual(out[1].items[0].lots.map((l) => [l.lot_number, l.unmatched_qty]), [['L1', 0]]);
});

// ---------- Keutuhan ----------

// Pembangkit acak deterministik (mulberry32)
const prng = (seed) => () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test('keutuhan: 1500 skenario acak (dua aturan retur) tidak pernah menghilangkan / menggandakan qty', () => {
    for (let seed = 1; seed <= 1500; seed += 1) {
        const rnd = prng(seed);
        const pick = (n) => Math.floor(rnd() * n);
        const poCount = pick(4);
        const allocations = Array.from({ length: poCount }, (_, i) => alloc(i + 1, {
            total_qty: pick(21) * 10,
            lot_product_code: rnd() < 0.5 ? '00045' : '00047',
            po_product_code: rnd() < 0.5 ? '00045' : '00047'
        }));
        const day = () => 10 + pick(8);
        const lines = Array.from({ length: pick(7) }, () => {
            const d = day();
            return line(d, { do_number: `D${pick(4)}`, do_datetime: `2026-07-${d} ${pick(2) ? '08' : '16'}:00:00`, qty_pcs: pick(15) * 10, product_code: rnd() < 0.5 ? '00045' : '00047', id_product: 1 });
        });
        const returnLines = Array.from({ length: pick(5) }, () => ret(pick(3), day(), { qty_pcs: pick(15) * 10, product_code: rnd() < 0.5 ? '00045' : '00047', id_product: 1 }));
        for (const returnMatch of Object.values(RETURN_MATCH)) {
            const input = { allocations, lines, returnLines, stockCodes: codes, returnMatch };
            const result = simulateLots(input);
            const problems = checkEstimateIntegrity(input, result);
            assert.deepEqual(problems, [], `seed ${seed} ${returnMatch}`);

            // total: qty DO - retur tercocok = pemakaian bersih PO + sisa tak terhubung (bersih)
            const shippedQty = lines.reduce((s, l) => s + l.qty_pcs, 0);
            const matched = returnLines.reduce((s, x) => s + x.qty_pcs - result.returnResults.get(x.id).unmatchedQty, 0);
            let netPo = 0;
            let netUnassigned = 0;
            lines.forEach((l) => {
                const st = result.doResults.get(l.id);
                st.segments.forEach((sg) => { netPo += sg.qty - sg.returned; });
                netUnassigned += st.unassignedQty - st.unassignedReturned;
            });
            assert.equal(netPo + netUnassigned, shippedQty - matched, `seed ${seed} ${returnMatch}: total bersih`);
        }
    }
});

test('pemeriksa keutuhan mendeteksi hasil yang rusak (qty ganda / hilang)', () => {
    const d1 = line(1, { qty_pcs: 100 });
    const x = ret(1, 14, { qty_pcs: 40 });
    const input = { allocations: [alloc(1)], lines: [d1], returnLines: [x], stockCodes: none };

    let result = simulateLots(input);
    result.doResults.get(d1.id).segments[0].qty += 1;                   // qty ganda
    assert.ok(checkEstimateIntegrity(input, result).some((p) => /segments \+ unassigned != qty/.test(p)));

    result = simulateLots(input);
    result.returnResults.get(x.id).releases[0].qty -= 1;                // qty retur hilang
    assert.ok(checkEstimateIntegrity(input, result).some((p) => /released \+ unmatched != qty/.test(p)));

    result = simulateLots(input);
    result.doResults.get(d1.id).segments[0].returned += 5;              // retur DO tidak sinkron
    assert.ok(checkEstimateIntegrity(input, result).length > 0);

    result = simulateLots(input);
    result.doResults.delete(d1.id);
    assert.ok(checkEstimateIntegrity(input, result).some((p) => /no result/.test(p)));
});

// ---------- Query ----------

const makeDb = ({ doLots = [{ lot_number: 'L1' }], returnLots = [{ lot_number: 'L1' }], allocations, lines, returnLines, log }) => ({
    query: async (sql) => {
        const t = sql.replace(/\s+/g, ' ').trim();
        log.push(t);
        if (/SELECT DISTINCT lot_number FROM delivery_order_lots/.test(t)) return [doLots];
        if (/SELECT DISTINCT lot_number FROM delivery_returns/.test(t)) return [returnLots];
        if (/FROM products$/.test(t)) return [PRODUCTS];
        if (/FROM product_code_mappings/.test(t)) return [MAPPINGS.map((m) => ({ ...m }))];
        if (/FROM po_lot_allocations pla/.test(t)) return [allocations];
        if (/FROM delivery_returns r JOIN products p/.test(t)) return [returnLines];
        if (/FROM delivery_order_lots dol/.test(t)) return [lines];
        return [[]];
    }
});

test('fetchEstimatedPo: alur query, kronologi DO + retur, dan hasil', async () => {
    const log = [];
    const db = makeDb({
        log,
        allocations: [alloc(1, { total_qty: '60', po_product_code: '00045', lot_product_code: '00045' }), alloc(2, { total_qty: '60' })],
        lines: [{ id: 1, delivery_order_id: 7, do_number: 'D7', do_datetime: '2026-07-10 10:00:00', id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: '100' }],
        returnLines: [{ id: 5, return_number: 'R1', return_datetime: '2026-07-12 09:00:00', id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: '30' }]
    });
    const out = await fetchEstimatedPo(db, [7]);
    assert.deepEqual(out[0].items[0].pos.map((p) => [p.po_number, p.qty_pcs, p.returned_pcs, p.via_mapping]), [['PO1', 60, 0, true], ['PO2', 40, 30, false]]);
    assert.equal(out[0].items[0].returned_qty, 30);

    const allocSql = log.find((t) => /FROM po_lot_allocations pla/.test(t));
    assert.match(allocSql, /pla\.status <> 'Canceled'/);
    assert.match(allocSql, /d\.deleted_at IS NULL/);
    const returnSql = log.find((t) => /FROM delivery_returns r JOIN products p/.test(t));
    assert.match(returnSql, /r\.id, r\.return_number/);        // baris retur, bukan total teragregasi
    assert.doesNotMatch(returnSql, /GROUP BY/);
    // tanpa lot: tidak ada query lanjutan
    const empty = await fetchEstimatedPo({ query: async () => [[]] }, [9]);
    assert.deepEqual(empty, []);
});

test('fetchEstimatedReturnPo: lot dari nomor retur, lalu simulasi seluruh lot dan hasil per retur', async () => {
    const log = [];
    const db = makeDb({
        log,
        allocations: [alloc(1, { total_qty: '100' })],
        lines: [
            { id: 1, delivery_order_id: 7, do_number: 'D7', do_datetime: '2026-07-10 10:00:00', id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: '100' },
            { id: 2, delivery_order_id: 8, do_number: 'D8', do_datetime: '2026-07-20 10:00:00', id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: '50' }
        ],
        returnLines: [{ id: 5, return_number: 'R1', return_datetime: '2026-07-12 09:00:00', id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: '30' }]
    });
    const out = await fetchEstimatedReturnPo(db, ['R1']);
    assert.equal(out.length, 1);
    assert.equal(out[0].return_number, 'R1');
    // retur tanggal 12 Jul hanya bisa dicocokkan ke D7 (D8 baru terjadi 20 Jul)
    assert.deepEqual(out[0].items[0].pos.map((p) => [p.po_number, p.qty_pcs, p.from]), [['PO1', 30, [{ do_number: 'D7', qty_pcs: 30 }]]]);
    assert.equal(out[0].items[0].unmatched_qty, 0);
    assert.ok(log.some((t) => /SELECT DISTINCT lot_number FROM delivery_returns WHERE return_number IN/.test(t)));

    const empty = await fetchEstimatedReturnPo({ query: async () => [[]] }, ['X']);
    assert.deepEqual(empty, []);
});

test('data normal tidak menghasilkan catatan galat keutuhan', async () => {
    const log = [];
    const errors = [];
    const original = console.error; console.error = (...a) => errors.push(a);
    try {
        const db = makeDb({
            log,
            allocations: [alloc(1)],
            lines: [{ id: 1, delivery_order_id: 7, do_number: 'D7', do_datetime: '2026-07-10 10:00:00', id_product: 2, product_code: '00047', lot_number: 'L1', qty_pcs: '40' }],
            returnLines: []
        });
        await fetchEstimatedPo(db, [7]);
    } finally { console.error = original; }
    assert.deepEqual(errors, []);
});
