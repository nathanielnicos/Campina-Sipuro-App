'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildStockCodeResolver } = require('../services/product-code-mapping/stockFamilyKey');
const { calculateDeliveryOrders } = require('../services/delivery-order/deliveryOrderCalculator');
const { fetchLotStock } = require('../services/delivery-order/deliveryOrderTotals');
const { stockKey, TRANS_TYPE } = require('../services/delivery-order/deliveryOrderRules');

// 45 (id 1) dan 47 (id 2) dipetakan; 99 (id 3) tanpa pemetaan
const PRODUCTS = [
    { id_product: 1, product_code: '00045', product_name: 'P45', pcs_per_ctn: 10 },
    { id_product: 2, product_code: '00047', product_name: 'P47', pcs_per_ctn: 10 },
    { id_product: 3, product_code: '00099', product_name: 'P99', pcs_per_ctn: 10 }
];
const MAPPINGS = [{ id_product_old: 1, id_product_new: 2 }];

test('resolver: kode keluarga = anggota dengan id terkecil; tanpa pemetaan = kode sendiri', () => {
    const r = buildStockCodeResolver(PRODUCTS, MAPPINGS);
    assert.equal(r.forProductCode('00045'), '00045');
    assert.equal(r.forProductCode('00047'), '00045');
    assert.equal(r.forProductCode('00099'), '00099');
    assert.equal(r.forProductCode('TIDAK-ADA'), 'TIDAK-ADA');
    assert.equal(r.forProductId(2), '00045');
    const none = buildStockCodeResolver(PRODUCTS, []);
    assert.equal(none.forProductCode('00047'), '00047');
});

const row = (n, { item = '00047', lot = 'FS2-260720', qty = 64, ref = '3400000424', type = TRANS_TYPE.ISSUE } = {}) => ({
    excelRowNumber: n, itemCode: item, lotNumber: lot, qty, qtyIsWhole: true, referenceNum: ref, lotStatus: 'GOOD',
    transType: type, transDateTime: '2026-07-21 10:00:00', rowHash: `h${n}`
});

// Pasangan lot-item yang ada: 45 dan 47 sama-sama tercatat pada lot FS2-260720
const stockWith = (allocated, { delivered = [], returned = [], stockCodes } = {}) => ({
    lotItemsFound: new Set([stockKey('00045', 'FS2-260720'), stockKey('00047', 'FS2-260720')]),
    allocated: new Map(allocated),
    delivered: new Map(delivered),
    returned: new Map(returned),
    ...(stockCodes ? { stockCodes } : {})
});

test('DO: kasus 45/47 - tiap kode memakai kuotanya sendiri, tidak dipooling (47 hanya 15.680)', () => {
    const stock = stockWith([[stockKey('00045', 'FS2-260720'), 725], [stockKey('00047', 'FS2-260720'), 15680]]);
    const over = calculateDeliveryOrders([row(1, { qty: 16000 })], [], PRODUCTS, stock);
    assert.equal(over.doLines.length, 0);
    assert.match(over.categorizedDetails.unallocatedRows[0].reason, /Available: 15680, Required: 16000/);
    const ok = calculateDeliveryOrders([row(1, { qty: 15680 })], [], PRODUCTS, stock);
    assert.equal(ok.categorizedDetails.unallocatedRows.length, 0);
    assert.equal(ok.doLines[0].itemCode, '00047');
});

test('DO: stockCodes pada stock diabaikan (pemetaan tidak memengaruhi upload DO)', () => {
    const codes = buildStockCodeResolver(PRODUCTS, MAPPINGS);
    const stock = stockWith([[stockKey('00045', 'FS2-260720'), 725 + 15680]], { stockCodes: codes });
    const res = calculateDeliveryOrders([row(1, { qty: 16000 })], [], PRODUCTS, stock);
    assert.equal(res.doLines.length, 0);
    assert.equal(res.categorizedDetails.unallocatedRows.length, 1);
});

test('DO: pengiriman dalam satu file saling mengurangi kuota kode yang sama', () => {
    const stock = stockWith([[stockKey('00047', 'FS2-260720'), 100]]);
    const res = calculateDeliveryOrders(
        [row(1, { item: '00047', qty: 60, ref: 'D1' }), row(2, { item: '00047', qty: 60, ref: 'D2' })],
        [], PRODUCTS, stock
    );
    assert.equal(res.doLines.length, 1);
    assert.equal(res.categorizedDetails.unallocatedRows.length, 1);
    assert.match(res.categorizedDetails.unallocatedRows[0].reason, /Available: 40, Required: 60/);
});

test('DO: retur kode 45 terhadap pengiriman kode 47 ditolak; retur kode 47 diterima', () => {
    const stock = stockWith([[stockKey('00047', 'FS2-260720'), 100]]);
    const res = calculateDeliveryOrders(
        [
            row(1, { item: '00047', qty: 50, ref: 'D1' }),
            row(2, { item: '00045', qty: 20, ref: 'R1', type: TRANS_TYPE.RETURN }),
            row(3, { item: '00047', qty: 20, ref: 'R2', type: TRANS_TYPE.RETURN })
        ],
        [], PRODUCTS, stock
    );
    assert.equal(res.doLines.length, 1);
    assert.deepEqual(res.returnLines.map((l) => [l.referenceNum, l.itemCode]), [['R2', '00047']]);
    assert.equal(res.categorizedDetails.unallocatedRows.length, 1);
    assert.equal(res.categorizedDetails.unallocatedRows[0].referenceNum, 'R1');
});

test('fetchLotStock: total kode 45 dan 47 pada lot yang sama dijumlahkan ke satu kunci', async () => {
    const codes = buildStockCodeResolver(PRODUCTS, MAPPINGS);
    const queryable = {
        query: async (sql) => {
            if (/delivery_order_lots/.test(sql) && !/delivery_returns/.test(sql)) {
                return [[{ product_code: '00047', lot_number: 'L', total_qty: 30 }]];
            }
            if (/delivery_returns/.test(sql)) return [[]];
            return [[
                { product_code: '00045', lot_number: 'L', total_qty: 725 },
                { product_code: '00047', lot_number: 'L', total_qty: 15680 },
                { product_code: '00099', lot_number: 'L', total_qty: 5 }
            ]];
        }
    };
    const { allocated, delivered } = await fetchLotStock(queryable, ['L'], { stockCodes: codes });
    assert.equal(allocated.get(stockKey('00045', 'L')), 16405);
    assert.equal(allocated.has(stockKey('00047', 'L')), false);
    assert.equal(allocated.get(stockKey('00099', 'L')), 5);
    assert.equal(delivered.get(stockKey('00045', 'L')), 30);
    // tanpa stockCodes: kunci per kode produk seperti semula
    const old = await fetchLotStock(queryable, ['L']);
    assert.equal(old.allocated.get(stockKey('00047', 'L')), 15680);
});
