'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDeliveryOrders, computeDeliveryFingerprint } = require('../services/delivery-order/deliveryOrderCalculator');
const { TRANS_TYPE, REASONS, stockKey } = require('../services/delivery-order/deliveryOrderRules');

const PRODUCTS = [
    { id_product: 1, product_code: 'FG-RA-00092', product_name: 'PF COLES LOADED CRUNCH', pcs_per_ctn: 34 },
    { id_product: 2, product_code: 'FG-ST-00046', product_name: 'PF COLES BLUEBERRY STICK', pcs_per_ctn: 44 },
    { id_product: 3, product_code: 'FG-NO-CTN', product_name: 'Tanpa karton', pcs_per_ctn: 0 }
];

let seq = 0;
const row = (over = {}) => {
    seq += 1;
    return {
        referenceNum: '3400000854',
        transType: TRANS_TYPE.ISSUE,
        lotStatus: 'GOOD',
        transDateTime: '2025-12-01 08:55:17',
        itemCode: 'FG-RA-00092',
        lotNumber: 'FR0-270527',
        qty: 100,
        qtyIsWhole: true,
        rawQtyText: '100',
        rowHash: `hash-${seq}`,
        excelRowNumber: seq + 6,
        ...over
    };
};
const ret = (over = {}) => row({ transType: TRANS_TYPE.RETURN, referenceNum: '1300000003', ...over });

const makeStock = ({ lots = [], allocated = {}, delivered = {}, returned = {} } = {}) => {
    const toMap = (o) => new Map(Object.entries(o).map(([k, v]) => [stockKey(...k.split('|')), v]));
    return { lotsFound: new Set(lots), allocated: toMap(allocated), delivered: toMap(delivered), returned: toMap(returned) };
};
const calc = (rows, stock, hashes = []) => calculateDeliveryOrders(rows, hashes, PRODUCTS, stock);
const reasonsOf = (result) => result.categorizedDetails.unallocatedRows.map((r) => r.reason);

test('DO sederhana: lot teralokasi cukup, qty pcs dan carton dihitung', () => {
    const out = calc([row({ qty: 340 })], makeStock({ lots: ['FR0-270527'], allocated: { 'FG-RA-00092|FR0-270527': 1000 } }));
    assert.equal(out.doLines.length, 1);
    assert.deepEqual(
        { ref: out.doLines[0].referenceNum, qty: out.doLines[0].qtyPcs, ctn: out.doLines[0].qtyCtn, product: out.doLines[0].productId },
        { ref: '3400000854', qty: 340, ctn: 10, product: 1 }
    );
    assert.equal(out.canSave, true);
    assert.equal(out.categorizedDetails.newRows.length, 1);
});

test('qty carton: dua desimal dan 0 bila pcs_per_ctn tidak diketahui', () => {
    const stock = makeStock({ lots: ['L'], allocated: { 'FG-RA-00092|L': 1000, 'FG-NO-CTN|L': 1000 } });
    const out = calc([row({ lotNumber: 'L', qty: 100 }), row({ lotNumber: 'L', itemCode: 'FG-NO-CTN', qty: 50 })], stock);
    assert.equal(out.doLines.find((l) => l.itemCode === 'FG-RA-00092').qtyCtn, 2.94);
    assert.equal(out.doLines.find((l) => l.itemCode === 'FG-NO-CTN').qtyCtn, 0);
});

test('satu DO banyak lot dan banyak item, satu lot di banyak DO', () => {
    const stock = makeStock({
        lots: ['FR0-270527', 'FR1-270527'],
        allocated: { 'FG-RA-00092|FR0-270527': 50000, 'FG-RA-00092|FR1-270527': 200000, 'FG-ST-00046|FR1-270527': 500 }
    });
    const out = calc([
        row({ referenceNum: '854', lotNumber: 'FR0-270527', qty: 28900 }),
        row({ referenceNum: '854', lotNumber: 'FR1-270527', qty: 73780 }),
        row({ referenceNum: '854', lotNumber: 'FR1-270527', itemCode: 'FG-ST-00046', qty: 100 }),
        row({ referenceNum: '855', lotNumber: 'FR1-270527', qty: 32640, transDateTime: '2025-12-01 10:53:09' })
    ], stock);
    assert.equal(out.doLines.length, 4);
    assert.equal(out.summary.doLineCount, 4);
    assert.equal(reasonsOf(out).length, 0);
});

test('baris dengan DO + item + lot sama dijumlahkan dan memakai tanggal paling awal', () => {
    const out = calc([
        row({ qty: 10, transDateTime: '2025-12-01 09:00:00' }),
        row({ qty: 15, transDateTime: '2025-12-01 08:00:00' })
    ], makeStock({ lots: ['FR0-270527'], allocated: { 'FG-RA-00092|FR0-270527': 100 } }));
    assert.equal(out.doLines.length, 1);
    assert.equal(out.doLines[0].qtyPcs, 25);
    assert.equal(out.doLines[0].transDateTime, '2025-12-01 08:00:00');
    assert.equal(out.doLines[0].rowCount, 2);
    assert.equal(out.categorizedDetails.newRows.length, 2);
});

test('sisa kuota = alokasi dikurangi yang sudah dikirim; melebihi sisa -> seluruh grup Unallocated dan tidak disimpan', () => {
    const stock = makeStock({ lots: ['L'], allocated: { 'FG-RA-00092|L': 1000 }, delivered: { 'FG-RA-00092|L': 900 } });
    const out = calc([row({ lotNumber: 'L', qty: 60 }), row({ lotNumber: 'L', qty: 60, transDateTime: '2025-12-01 09:00:00' })], stock);
    assert.equal(out.doLines.length, 0);
    assert.equal(out.canSave, false);
    assert.equal(out.categorizedDetails.newRows.length, 0);
    assert.equal(out.categorizedDetails.unallocatedRows.length, 2);
    assert.match(reasonsOf(out)[0], /Exceeds allocated quantity \(Available: 100, Required: 120\)/);
});

test('dua DO bersaing untuk satu lot: urutan tanggal lalu nomor DO, yang kedua ditolak bila sisa tidak cukup', () => {
    const stock = makeStock({ lots: ['L'], allocated: { 'FG-RA-00092|L': 100 } });
    const out = calc([
        row({ referenceNum: 'B', lotNumber: 'L', qty: 60, transDateTime: '2025-12-01 10:00:00' }),
        row({ referenceNum: 'A', lotNumber: 'L', qty: 60, transDateTime: '2025-12-01 09:00:00' })
    ], stock);
    assert.deepEqual(out.doLines.map((l) => l.referenceNum), ['A']);
    assert.equal(out.categorizedDetails.unallocatedRows[0].referenceNum, 'B');
});

test('urutan baris di file tidak mengubah hasil', () => {
    const stock = () => makeStock({ lots: ['L'], allocated: { 'FG-RA-00092|L': 100 } });
    const rows = () => [
        row({ referenceNum: 'B', lotNumber: 'L', qty: 60, transDateTime: '2025-12-01 10:00:00', rowHash: 'b' }),
        row({ referenceNum: 'A', lotNumber: 'L', qty: 60, transDateTime: '2025-12-01 09:00:00', rowHash: 'a' })
    ];
    const first = calc(rows(), stock());
    const second = calc(rows().reverse(), stock());
    assert.deepEqual(first.doLines.map((l) => l.referenceNum), second.doLines.map((l) => l.referenceNum));
});

test('alasan penolakan: lot tidak ada, tanpa alokasi, nomor DO/lot/tanggal kosong, qty nol atau negatif', () => {
    const stock = makeStock({ lots: ['EXIST'], allocated: {} });
    const out = calc([
        row({ lotNumber: 'GHOST' }),
        row({ lotNumber: 'EXIST' }),
        row({ referenceNum: '' }),
        row({ lotNumber: '' }),
        row({ transDateTime: null }),
        row({ qty: 0 }),
        row({ qty: -5 })
    ], stock);
    // Urutan mengikuti baris Excel
    assert.deepEqual(reasonsOf(out), [
        REASONS.LOT_NOT_FOUND,
        REASONS.NO_ALLOCATION,
        REASONS.MISSING_DO_NUMBER,
        REASONS.MISSING_LOT,
        REASONS.MISSING_DATE,
        REASONS.NON_POSITIVE_QTY,
        REASONS.NON_POSITIVE_QTY
    ]);
});

test('kategori lain: tidak terdaftar, duplikat, non-GOOD', () => {
    const stock = makeStock({ lots: ['L'], allocated: { 'FG-RA-00092|L': 100 } });
    const out = calc([
        row({ itemCode: 'UNKNOWN', lotNumber: 'L' }),
        row({ lotNumber: 'L', rowHash: 'dup' }),
        row({ lotNumber: 'L', lotStatus: 'HOLD' }),
        row({ lotNumber: 'L', qty: 10 })
    ], stock, ['dup']);
    assert.equal(out.categorizedDetails.unregisteredRows.length, 1);
    assert.equal(out.categorizedDetails.duplicateRows.length, 1);
    assert.equal(out.categorizedDetails.nonGoodRows.length, 1);
    assert.equal(out.doLines.length, 1);
    assert.equal(out.summary.totalRows, 4);
});

test('qty desimal pada produk terdaftar menggagalkan dengan 422; produk tidak terdaftar tidak', () => {
    const stock = makeStock({ lots: ['L'], allocated: {} });
    assert.throws(() => calc([row({ qty: 2.5, qtyIsWhole: false, rawQtyText: '2.5' })], stock), (e) => e.status === 422);
    assert.doesNotThrow(() => calc([row({ itemCode: 'UNKNOWN', qty: 2.5, qtyIsWhole: false })], stock));
});

test('alokasi Force Closed ikut terhitung (total alokasi non-Canceled dari database)', () => {
    // allocated sudah memuat Force Closed; kalkulator hanya membaca totalnya
    const out = calc([row({ qty: 800 })], makeStock({ lots: ['FR0-270527'], allocated: { 'FG-RA-00092|FR0-270527': 800 } }));
    assert.equal(out.doLines.length, 1);
});

test('retur: dihitung terhadap total terkirim, tidak mengubah DO, dan tidak butuh alokasi', () => {
    const stock = makeStock({ lots: ['L'], allocated: { 'FG-ST-00046|L': 0 }, delivered: { 'FG-ST-00046|L': 100 } });
    const out = calc([ret({ itemCode: 'FG-ST-00046', lotNumber: 'L', qty: 44 })], stock);
    assert.equal(out.returnLines.length, 1);
    assert.equal(out.returnLines[0].qtyCtn, 1);
    assert.equal(out.doLines.length, 0);
    assert.equal(out.summary.validReturnRows, 1);
    assert.equal(out.summary.validDoRows, 0);
});

test('retur: DO dalam file yang sama ikut dihitung (DO diproses lebih dulu)', () => {
    const stock = makeStock({ lots: ['L'], allocated: { 'FG-RA-00092|L': 500 } });
    const out = calc([
        ret({ lotNumber: 'L', qty: 80 }),
        row({ lotNumber: 'L', qty: 100 })
    ], stock);
    assert.equal(out.doLines.length, 1);
    assert.equal(out.returnLines.length, 1);
});

test('retur ditolak: lot tidak ada, belum ada pengiriman, melebihi terkirim (dikurangi retur sebelumnya)', () => {
    const stock = makeStock({
        lots: ['L1', 'L2', 'L3'],
        delivered: { 'FG-RA-00092|L2': 100, 'FG-RA-00092|L3': 100 },
        returned: { 'FG-RA-00092|L3': 70 }
    });
    const out = calc([
        ret({ lotNumber: 'GHOST', qty: 1 }),
        ret({ lotNumber: 'L1', qty: 1 }),
        ret({ lotNumber: 'L2', qty: 101 }),
        ret({ lotNumber: 'L3', qty: 31 })
    ], stock);
    assert.equal(out.returnLines.length, 0);
    const reasons = reasonsOf(out);
    assert.equal(reasons.filter((r) => r === REASONS.LOT_NOT_FOUND).length, 1);
    assert.equal(reasons.filter((r) => r === REASONS.NO_DELIVERY).length, 1);
    assert.ok(reasons.some((r) => /Return exceeds delivered quantity \(Returnable: 100, Required: 101\)/.test(r)));
    assert.ok(reasons.some((r) => /Returnable: 30, Required: 31/.test(r)));
});

test('retur: nomor retur kosong dan retur dari nomor sama dijumlahkan; DO tidak terpengaruh nilai retur', () => {
    const stock = makeStock({ lots: ['L'], delivered: { 'FG-RA-00092|L': 100 } });
    const out = calc([
        ret({ lotNumber: 'L', qty: 10 }),
        ret({ lotNumber: 'L', qty: 15 }),
        ret({ lotNumber: 'L', qty: 5, referenceNum: '' })
    ], stock);
    assert.equal(out.returnLines.length, 1);
    assert.equal(out.returnLines[0].qtyPcs, 25);
    assert.deepEqual(reasonsOf(out), [REASONS.MISSING_RETURN_NUMBER]);
});

test('retur tidak membuka kuota kirim lagi', () => {
    const stock = makeStock({
        lots: ['L'],
        allocated: { 'FG-RA-00092|L': 100 },
        delivered: { 'FG-RA-00092|L': 100 },
        returned: { 'FG-RA-00092|L': 100 }
    });
    const out = calc([row({ lotNumber: 'L', qty: 1 })], stock);
    assert.equal(out.doLines.length, 0);
});

test('fingerprint stabil untuk input sama dan berubah bila hasil berubah', () => {
    const make = (alloc) => calc([row({ lotNumber: 'L', qty: 50, rowHash: 'x' })], makeStock({ lots: ['L'], allocated: { 'FG-RA-00092|L': alloc } }));
    assert.equal(computeDeliveryFingerprint(make(100)), computeDeliveryFingerprint(make(100)));
    assert.notEqual(computeDeliveryFingerprint(make(100)), computeDeliveryFingerprint(make(10)));
});
