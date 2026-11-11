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

test('shapeByReturn: baris rata, qty angka', () => {
    const rt = shapeByReturn([{ return_id: 3, return_number: 'RT1', return_datetime: 't', lot_number: 'L1', id_product: 1, product_code: 'A', product_name: 'Prod A', qty_pcs: '44', qty_ctn: '1.00' }]);
    assert.equal(rt[0].qty_pcs, 44);
    assert.equal(rt[0].qty_ctn, 1);
});

const ledger = (type, lot, id, number, at, pcs, ctn, extra = {}) => ({
    entry_type: type, lot_number: lot, id_product: 1, product_code: 'A', product_name: 'Prod A', pcs_per_ctn: 50,
    ref_id: id, ref_number: number, entry_datetime: at, qty_pcs: String(pcs), qty_ctn: String(ctn), ...extra
});
const lotInfo = (lot, qty, allocated) => ({
    lot_number: lot, id_product: 1, actual_completed_datetime: '2025-11-01 08:00:00', expired_date: '2027-11-01',
    qty_lot: String(qty), allocated_qty: String(allocated)
});

test('shapeByLot: saldo berjalan = Qty Lot - DO + retur, DO negatif dan retur positif', () => {
    const rows = shapeByLot(
        [
            ledger('RETURN', 'L1', 7, 'RT1', '2025-12-03 09:00:00', 44, 0.88),
            ledger('DO', 'L1', 12, 'DO2', '2025-12-02 08:00:00', 100, 2),
            ledger('DO', 'L1', 11, 'DO1', '2025-12-01 08:00:00', 300, 6)
        ],
        [lotInfo('L1', 1000, 1000)],
        ['L1']
    );

    assert.deepEqual(rows.map((r) => r.entry_number), ['DO1', 'DO2', 'RT1']);
    assert.deepEqual(rows.map((r) => r.signed_qty_pcs), [-300, -100, 44]);
    assert.deepEqual(rows.map((r) => r.signed_qty_ctn), [-6, -2, 0.88]);
    assert.deepEqual(rows.map((r) => r.balance_pcs), [700, 600, 644]);
    assert.equal(rows[0].qty_lot, 1000);
    assert.equal(rows[0].qty_lot_ctn, 20);
    assert.equal(rows[0].balance_ctn, 14);
    assert.equal(rows[0].is_unallocated, false);
    assert.equal(rows[0].actual_completed_datetime, '2025-11-01 08:00:00');
    assert.equal(rows[0].expired_date, '2027-11-01');
});

test('shapeByLot: field lama tetap ada untuk DO dan null untuk retur', () => {
    const rows = shapeByLot(
        [ledger('DO', 'L1', 11, 'DO1', '2025-12-01 08:00:00', 10, 0.2), ledger('RETURN', 'L1', 7, 'RT1', '2025-12-02 08:00:00', 4, 0.08)],
        [lotInfo('L1', 100, 100)], ['L1']
    );
    assert.equal(rows[0].delivery_order_id, 11);
    assert.equal(rows[0].do_number, 'DO1');
    assert.equal(rows[0].do_datetime, '2025-12-01 08:00:00');
    assert.equal(rows[0].qty_pcs, 10);
    assert.equal(rows[0].entry_type, 'DO');
    assert.equal(rows[1].delivery_order_id, null);
    assert.equal(rows[1].do_number, null);
    assert.equal(rows[1].do_datetime, null);
    assert.equal(rows[1].entry_type, 'RETURN');
    assert.equal(rows[1].qty_pcs, 4);
});

test('shapeByLot: waktu sama -> DO dulu baru retur (saldo tidak sempat minus semu)', () => {
    const at = '2025-12-01 08:00:00';
    const rows = shapeByLot(
        [ledger('RETURN', 'L1', 1, 'RT1', at, 100, 2), ledger('DO', 'L1', 2, 'DO1', at, 100, 2)],
        [lotInfo('L1', 100, 100)], ['L1']
    );
    assert.deepEqual(rows.map((r) => r.entry_type), ['DO', 'RETURN']);
    assert.deepEqual(rows.map((r) => r.balance_pcs), [0, 100]);
});

test('shapeByLot: lot tanpa alokasi (mis. rework) ditandai; lot tanpa data lot -> Qty Lot 0, tidak ditandai', () => {
    const rework = shapeByLot([ledger('DO', 'L1', 1, 'DO1', '2025-12-01 08:00:00', 10, 0.2)], [lotInfo('L1', 1520, 0)], ['L1']);
    assert.equal(rework[0].is_unallocated, true);
    assert.equal(rework[0].balance_pcs, 1510);

    const unknown = shapeByLot([ledger('DO', 'L9', 1, 'DO1', '2025-12-01 08:00:00', 10, 0.2)], [], ['L9']);
    assert.equal(unknown[0].qty_lot, 0);
    assert.equal(unknown[0].is_unallocated, false);
    assert.equal(unknown[0].balance_pcs, -10);
    assert.equal(unknown[0].actual_completed_datetime, null);
});

test('shapeByLot: DO dengan id produk lama tetap memakai data lot bila nomor lot hanya punya satu data lot', () => {
    const rows = shapeByLot(
        [ledger('DO', 'L1', 1, 'DO1', '2025-12-01 08:00:00', 10, 0.2, { id_product: 99 })],
        [lotInfo('L1', 100, 100)], ['L1']
    );
    assert.equal(rows[0].qty_lot, 100);
    assert.equal(rows[0].balance_pcs, 90);
});

test('shapeByLot: urutan lot mengikuti halaman, produk tanpa pcs per carton -> carton 0', () => {
    const rows = shapeByLot(
        [
            ledger('DO', 'L2', 1, 'DO1', '2025-12-01 08:00:00', 10, 0, { pcs_per_ctn: 0 }),
            ledger('DO', 'L1', 2, 'DO2', '2025-12-01 08:00:00', 10, 0.2)
        ],
        [lotInfo('L1', 100, 100), lotInfo('L2', 100, 100)],
        ['L2', 'L1']
    );
    assert.deepEqual(rows.map((r) => r.lot_number), ['L2', 'L1']);
    assert.equal(rows[0].qty_lot_ctn, 0);
    assert.equal(rows[0].balance_ctn, 0);
});

test('tampilan lot: induk nomor lot, lalu ledger DO + retur dan data lot untuk lot yang tampil (tanpa filter)', async () => {
    const db = fakeDb([
        [{ total: 1 }],
        [{ key_id: 'L1' }],
        [ledger('DO', 'L1', 11, 'DO1', '2025-12-01 08:00:00', 300, 6), ledger('RETURN', 'L1', 7, 'RT1', '2025-12-03 09:00:00', 44, 0.88)],
        [lotInfo('L1', 1000, 1000)]
    ]);
    const request = parseDeliveryOrderRequest({ displayMode: 'BY_LOT', search: 'DO1', fromDoDate: '2025-12-01' });
    const { data, totalItems } = await fetchDeliveryOrderPage(db, request);

    assert.equal(totalItems, 1);
    assert.match(db.log[0].sql, /COUNT\(DISTINCT dol\.lot_number\)/);
    assert.match(db.log[0].sql, /d\.do_number LIKE \?/); // filter menentukan lot yang tampil
    assert.equal(db.log.length, 4);

    // ledger: DO dan retur, hanya difilter nomor lot (filter tanggal / pencarian tidak mempengaruhi saldo)
    assert.match(db.log[2].sql, /dol\.lot_number IN \(\?\)/);
    assert.match(db.log[2].sql, /UNION ALL/);
    assert.match(db.log[2].sql, /r\.lot_number IN \(\?\)/);
    assert.ok(!/LIKE|do_datetime >=/.test(db.log[2].sql));
    assert.deepEqual(db.log[2].params, [['L1'], ['L1']]);

    // data lot: produksi bersih dari upload (arah IN/OUT) dan alokasi selain Canceled
    assert.match(db.log[3].sql, /FROM lots l/);
    assert.match(db.log[3].sql, /upload_trans_types/);
    assert.match(db.log[3].sql, /status <> 'Canceled'/);
    assert.deepEqual(db.log[3].params, [['L1'], ['L1']]);

    assert.deepEqual(data.map((r) => r.balance_pcs), [700, 744]);
    assert.deepEqual(data.map((r) => r.signed_qty_pcs), [-300, 44]);
});

test('tampilan retur memakai induk nomor retur', async () => {
    const db = fakeDb([[{ total: 1 }], [{ key_id: 'RT1' }], []]);
    await fetchDeliveryOrderPage(db, parseDeliveryOrderRequest({ displayMode: 'BY_RETURN' }));
    assert.match(db.log[0].sql, /COUNT\(DISTINCT r\.return_number\)/);
    assert.match(db.log[2].sql, /r\.return_number IN \(\?\)/);
});
