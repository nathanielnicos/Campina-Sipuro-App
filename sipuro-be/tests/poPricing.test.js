'use strict';

/**
 * Tes perhitungan harga PO di server (helpers/poPricing.js).
 * Memakai database tiruan, tidak menyentuh database sungguhan.
 * Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

// helpers/poHelper memuat konfigurasi database. Selama tes, modul itu diganti
// supaya tes tidak pernah membuat koneksi ke database sungguhan.
const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request === 'config/db' || request.endsWith('/config/db')) return { sipuroDb: null };
    return originalLoad.apply(this, arguments);
};

const { priceItems } = require('../helpers/poPricing');

function mockDb({ products, prices }) {
    return {
        async query(sql, params) {
            if (/FROM sipuro_db\.products/.test(sql)) return [products.filter((p) => params[0].includes(p.id_product))];
            if (/product_selling_prices/.test(sql)) return [prices.filter((p) => params[0].includes(p.id_product))];
            throw new Error('query tidak terduga: ' + sql);
        }
    };
}

const P = (id, extra = {}) => ({
    id_product: id,
    product_name: 'Prod' + id,
    base_uom: 'PCS',
    pcs_per_ctn: 12,
    ctn_per_plt: 10,
    ml_per_pcs: null,
    kg_per_pcs: null,
    is_active: 1,
    ...extra
});

test('PO baru memakai harga aktif hari ini dan mengabaikan harga dari klien', async () => {
    const db = mockDb({
        products: [P(1), P(2)],
        prices: [{ id_product: 1, price: '1234.56' }, { id_product: 2, price: '1000.00' }]
    });
    const r = await priceItems({
        db,
        items: [
            { id_product: 1, qty: 3, unit_price: 1, total_price: 1 },
            { id_product: 2, qty: 2, unit_price: 999999 }
        ],
        ppnPercent: 11
    });
    assert.equal(r.lines[0].totalPrice, 3704);
    assert.equal(r.lines[0].basePrice, 1234.56);
    assert.equal(r.lines[0].uom, 'PCS');
    assert.equal(r.lines[0].baseQty, 3);
    assert.equal(r.subtotal, 5704);
    assert.equal(r.ppnAmount, 627);
    assert.equal(r.totalAmount, 6331);
});

test('jika ada beberapa harga aktif, harga dengan start_date terbaru dipakai', async () => {
    const db = {
        async query(sql) {
            if (/products/.test(sql)) return [[P(1)]];
            // Sudah terurut menurun menurut start_date oleh SQL.
            return [[{ id_product: 1, price: '500.00' }, { id_product: 1, price: '100.00' }]];
        }
    };
    const r = await priceItems({ db, items: [{ id_product: 1, qty: 1 }], ppnPercent: 0 });
    assert.equal(r.lines[0].totalPrice, 500);
});

test('Draft: semua baris dihitung ulang dengan harga hari ini', async () => {
    const db = mockDb({ products: [P(1)], prices: [{ id_product: 1, price: '2000.00' }] });
    const existingMap = new Map([[10, { id_product: 1, qty: 5, base_qty: 5, base_price: '1000.00' }]]);
    const r = await priceItems({
        db,
        items: [{ id_product: 1, qty: 5, po_detail_id: 10 }],
        poStatus: 'Draft',
        existingMap,
        ppnPercent: 11
    });
    assert.equal(r.lines[0].totalPrice, 10000);
});

test('Waiting for Confirmation: baris lama terkunci, baris baru atau berganti produk memakai harga hari ini', async () => {
    const db = mockDb({
        products: [P(1), P(2), P(3)],
        prices: [{ id_product: 1, price: '2000.00' }, { id_product: 2, price: '300.00' }, { id_product: 3, price: '70.00' }]
    });
    const existingMap = new Map([
        [10, { id_product: 1, qty: 5, base_qty: 5, base_price: '1000.00' }],
        [11, { id_product: 2, qty: 1, base_qty: 1, base_price: '250.00' }]
    ]);
    const r = await priceItems({
        db,
        items: [
            { id_product: 1, qty: 8, po_detail_id: 10 },  // terkunci 1.000
            { id_product: 3, qty: 2, po_detail_id: 11 },  // produk berganti -> harga hari ini 70
            { id_product: 2, qty: 1 }                      // baris baru -> harga hari ini 300
        ],
        poStatus: 'Waiting for Confirmation',
        existingMap,
        ppnPercent: 0
    });
    assert.deepEqual(r.lines.map((l) => l.totalPrice), [8000, 140, 300]);
    assert.equal(r.lines[0].unitPrice, 1000);
});

test('Waiting: baris terkunci tetap lolos walau produk nonaktif atau harga hari ini tidak ada', async () => {
    const db = mockDb({ products: [P(1, { is_active: 0 })], prices: [] });
    const existingMap = new Map([[10, { id_product: 1, qty: 5, base_qty: 5, base_price: '1000.00' }]]);
    const r = await priceItems({
        db,
        items: [{ id_product: 1, qty: 6, po_detail_id: 10 }],
        poStatus: 'Waiting for Confirmation',
        existingMap,
        ppnPercent: 0
    });
    assert.equal(r.lines[0].totalPrice, 6000);
});

test('validasi input', async () => {
    const db = mockDb({
        products: [P(1), P(2, { is_active: 0 })],
        prices: [{ id_product: 1, price: '100.00' }, { id_product: 2, price: '100.00' }]
    });
    const run = (items) => priceItems({ db, items, ppnPercent: 11 });

    await assert.rejects(run([]), /Incomplete/);
    await assert.rejects(run([{ id_product: 1, qty: 0 }]), /whole number/);
    await assert.rejects(run([{ id_product: 1, qty: 1.5 }]), /whole number/);
    await assert.rejects(run([{ id_product: 1, qty: 1000000001 }]), /1\.000\.000\.000/);
    await assert.rejects(run([{ id_product: 1, qty: 1 }, { id_product: 1, qty: 2 }]), /more than once/);
    await assert.rejects(run([{ id_product: null, qty: 1 }]), /product selected/);
    await assert.rejects(run([{ id_product: 99, qty: 1 }]), /no longer exists/);
    await assert.rejects(run([{ id_product: 2, qty: 1 }]), /no longer available/);

    // qty tepat 1.000.000.000 masih boleh.
    const r = await run([{ id_product: 1, qty: 1000000000 }]);
    assert.equal(r.lines[0].totalPrice, 100000000000);
});

test('total terlalu besar -> kesalahan validasi (400) dengan pesan ramah', async () => {
    const db = mockDb({ products: [P(1)], prices: [{ id_product: 1, price: '99999999.00' }] });
    const error = await priceItems({ db, items: [{ id_product: 1, qty: 1000000000 }], ppnPercent: 11 }).catch((e) => e);
    assert.equal(error.isValidation, true);
    assert.equal(error.statusCode, 400);
    assert.match(error.message, /too large/);
});

test('satuan dasar CTN: qty dasar dan harga per satuan dasar', async () => {
    const db = mockDb({
        products: [P(1, { base_uom: 'CTN', pcs_per_ctn: 12 })],
        prices: [{ id_product: 1, price: '12000.00' }]
    });
    const r = await priceItems({ db, items: [{ id_product: 1, qty: 2 }], ppnPercent: 0 });
    assert.equal(r.lines[0].baseQty, 24);
    assert.equal(r.lines[0].basePrice, 1000);
    assert.equal(r.lines[0].totalPrice, 24000);

    // qty dasar melewati batas kolom INT ditolak.
    await assert.rejects(
        priceItems({ db, items: [{ id_product: 1, qty: 900000000 }], ppnPercent: 0 }),
        /too large/
    );
});
