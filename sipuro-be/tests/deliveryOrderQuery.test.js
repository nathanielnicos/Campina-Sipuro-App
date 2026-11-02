'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDeliveryOrderRequest, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } = require('../services/delivery-order/deliveryOrderFilters');
const { fetchDeliveryOrderPage, shapeByDo, shapeByLot, shapeByReturn } = require('../services/delivery-order/deliveryOrderQuery');

test('parameter: default, mode salah, tanggal salah, rentang terbalik, limit dibatasi', () => {
    const req = parseDeliveryOrderRequest({});
    assert.equal(req.displayMode, 'BY_DO');
    assert.equal(req.limit, DEFAULT_PAGE_LIMIT);
    assert.equal(req.order, 'DESC');
    assert.throws(() => parseDeliveryOrderRequest({ displayMode: 'BY_PO' }), (e) => e.status === 400);
    assert.throws(() => parseDeliveryOrderRequest({ fromDoDate: '2025-02-31' }), (e) => e.status === 400);
    assert.throws(() => parseDeliveryOrderRequest({ fromDoDate: '2025-12-02', toDoDate: '2025-12-01' }), (e) => e.status === 400);
    assert.equal(parseDeliveryOrderRequest({ limit: '100000' }).limit, MAX_PAGE_LIMIT);
    assert.equal(parseDeliveryOrderRequest({ sortOrder: 'asc' }).order, 'ASC');
});

test('filter pencarian: LIKE di-escape dan memakai kolom yang benar per tampilan', () => {
    const doReq = parseDeliveryOrderRequest({ search: '50%_x', fromDoDate: '2025-12-01', toDoDate: '2025-12-31' });
    assert.match(doReq.whereSql, /d\.do_number LIKE \?/);
    assert.match(doReq.whereSql, /dol\.lot_number LIKE \?/);
    assert.match(doReq.whereSql, /dol\.do_datetime >= \?/);
    assert.deepEqual(doReq.params.slice(0, 4), ['%50\\%\\_x%', '%50\\%\\_x%', '%50\\%\\_x%', '%50\\%\\_x%']);
    assert.deepEqual(doReq.params.slice(4), ['2025-12-01 00:00:00', '2025-12-31 23:59:59']);

    const retReq = parseDeliveryOrderRequest({ displayMode: 'BY_RETURN', search: 'RT' });
    assert.match(retReq.whereSql, /r\.return_number LIKE \?/);
    assert.ok(!/dol\./.test(retReq.whereSql));
});

// Pengganti database: mencatat query, menjawab sesuai urutan (hitung, halaman induk, baris)
const fakeDb = (answers) => {
    const log = [];
    return {
        log,
        query: async (sql, params) => {
            log.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
            return [answers.shift()];
        }
    };
};

test('dua langkah: hitung induk, ambil halaman induk, lalu baris anak berfilter sama', async () => {
    const db = fakeDb([
        [{ total: 25 }],
        [{ key_id: 11 }, { key_id: 12 }],
        [{ delivery_order_id: 11, do_number: 'DO1', do_datetime: '2025-12-01 08:00:00', id_product: 1, product_code: 'A', product_name: 'Prod A', lot_number: 'L1', qty_pcs: '100', qty_ctn: '2.5', lot_datetime: '2025-12-01 08:00:00' }]
    ]);
    const request = parseDeliveryOrderRequest({ search: 'DO1', page: '2', limit: '10' });
    const { data, totalItems } = await fetchDeliveryOrderPage(db, request);

    assert.equal(totalItems, 25);
    assert.equal(data.length, 1);
    assert.match(db.log[0].sql, /COUNT\(DISTINCT d\.id\)/);
    assert.match(db.log[1].sql, /GROUP BY d\.id, d\.do_datetime ORDER BY d\.do_datetime DESC, d\.id DESC LIMIT \? OFFSET \?/);
    assert.deepEqual(db.log[1].params.slice(-2), [10, 10]);
    assert.match(db.log[2].sql, /d\.id IN \(\?\)/);
    assert.match(db.log[2].sql, /d\.do_number LIKE \?/);
    assert.deepEqual(db.log[2].params[db.log[2].params.length - 1], [11, 12]);
});

test('hasil kosong: berhenti setelah hitung tanpa query lanjutan', async () => {
    const db = fakeDb([[{ total: 0 }]]);
    const out = await fetchDeliveryOrderPage(db, parseDeliveryOrderRequest({}));
    assert.deepEqual(out, { data: [], totalItems: 0 });
    assert.equal(db.log.length, 1);
});

test('shapeByDo: DO -> item -> lot, total item dan tanggal paling awal', () => {
    const rows = [
        { delivery_order_id: 1, do_number: 'DO1', do_datetime: '2025-12-01 08:00:00', id_product: 1, product_code: 'A', product_name: 'Prod A', lot_number: 'L1', qty_pcs: '100', qty_ctn: '2.94', lot_datetime: '2025-12-01 09:00:00' },
        { delivery_order_id: 1, do_number: 'DO1', do_datetime: '2025-12-01 08:00:00', id_product: 1, product_code: 'A', product_name: 'Prod A', lot_number: 'L2', qty_pcs: '50', qty_ctn: '1.47', lot_datetime: '2025-12-01 08:00:00' },
        { delivery_order_id: 1, do_number: 'DO1', do_datetime: '2025-12-01 08:00:00', id_product: 2, product_code: 'B', product_name: 'Prod B', lot_number: 'L3', qty_pcs: '5', qty_ctn: '0.11', lot_datetime: '2025-12-01 08:30:00' },
        { delivery_order_id: 2, do_number: 'DO2', do_datetime: '2025-12-02 08:00:00', id_product: 1, product_code: 'A', product_name: 'Prod A', lot_number: 'L1', qty_pcs: '7', qty_ctn: '0.21', lot_datetime: '2025-12-02 08:00:00' }
    ];
    const shaped = shapeByDo(rows);
    assert.equal(shaped.length, 2);
    const itemA = shaped[0].items[0];
    assert.equal(itemA.total_qty_pcs, 150);
    assert.equal(itemA.total_qty_ctn, 4.41);
    assert.equal(itemA.date_time, '2025-12-01 08:00:00');
    assert.deepEqual(itemA.lots.map((l) => l.lot_number), ['L1', 'L2']);
    assert.equal(shaped[0].items.length, 2);
});

test('shapeByLot dan shapeByReturn: baris rata, qty angka', () => {
    const lot = shapeByLot([{ lot_number: 'L1', id_product: 1, product_code: 'A', product_name: 'Prod A', actual_completed_datetime: 'x', expired_date: 'y', delivery_order_id: 1, do_number: 'DO1', do_datetime: 'z', qty_pcs: '10', qty_ctn: '0.5' }]);
    assert.deepEqual(lot[0], { lot_number: 'L1', id_product: 1, product_code: 'A', product_name: 'Prod A', actual_completed_datetime: 'x', expired_date: 'y', delivery_order_id: 1, do_number: 'DO1', do_datetime: 'z', qty_pcs: 10, qty_ctn: 0.5 });
    const rt = shapeByReturn([{ return_id: 3, return_number: 'RT1', return_datetime: 't', lot_number: 'L1', id_product: 1, product_code: 'A', product_name: 'Prod A', qty_pcs: '44', qty_ctn: '1.00' }]);
    assert.equal(rt[0].qty_pcs, 44);
    assert.equal(rt[0].qty_ctn, 1);
});

test('tampilan lot dan retur memakai induk nomor lot / nomor retur', async () => {
    let db = fakeDb([[{ total: 1 }], [{ key_id: 'L1' }], []]);
    await fetchDeliveryOrderPage(db, parseDeliveryOrderRequest({ displayMode: 'BY_LOT' }));
    assert.match(db.log[0].sql, /COUNT\(DISTINCT dol\.lot_number\)/);
    assert.match(db.log[2].sql, /dol\.lot_number IN \(\?\)/);

    db = fakeDb([[{ total: 1 }], [{ key_id: 'RT1' }], []]);
    await fetchDeliveryOrderPage(db, parseDeliveryOrderRequest({ displayMode: 'BY_RETURN' }));
    assert.match(db.log[0].sql, /COUNT\(DISTINCT r\.return_number\)/);
    assert.match(db.log[2].sql, /r\.return_number IN \(\?\)/);
});
