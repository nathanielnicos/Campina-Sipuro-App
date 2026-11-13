'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const path = require('path');

// xlsx tiruan: mencatat isi tiap sheet; write mengembalikan JSON agar bisa dibaca ulang di tes
const fakeXlsx = {
    utils: {
        aoa_to_sheet: (aoa) => ({ __aoa: aoa }),
        book_new: () => ({ sheets: [] }),
        book_append_sheet: (wb, sheet, name) => wb.sheets.push({ name, sheet })
    },
    write: (wb) => Buffer.from(JSON.stringify({ sheets: wb.sheets.map((s) => ({ name: s.name, aoa: s.sheet.__aoa, filter: s.sheet['!autofilter'] })) }))
};

// Database tiruan: jawaban dipilih dari bentuk SQL-nya
const state = { counts: [0, 0], deliveries: [], returns: [], mappings: [], products: [], stock: { allocated: [], delivered: [], returned: [] }, lotQty: [], queries: [], dbError: null };
const fakeDb = {
    query: async (sql, params) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        state.queries.push({ sql: text, params });
        if (state.dbError) throw state.dbError;
        if (/^SELECT COUNT\(\*\) AS total FROM \(SELECT 1/.test(text)) return [[{ total: state.counts[0] }]];
        if (/^SELECT COUNT\(\*\) AS total FROM delivery_returns/.test(text)) return [[{ total: state.counts[1] }]];
        if (/^SELECT d\.do_number/.test(text)) return [state.deliveries];
        if (/^SELECT r\.return_number/.test(text)) return [state.returns];
        if (/FROM production_lot_upload_details/.test(text)) return [state.lotQty];
        if (/FROM product_code_mappings/.test(text)) return [state.mappings];
        if (/^SELECT id_product, product_code FROM products/.test(text)) return [state.products];
        if (/^SELECT product_code, product_name FROM products/.test(text)) return [state.products.map((p) => ({ product_code: p.product_code, product_name: `Nama ${p.product_code}` }))];
        if (/FROM po_lot_allocations/.test(text)) return [state.stock.allocated];
        if (/FROM delivery_order_lots/.test(text)) return [state.stock.delivered];
        if (/FROM delivery_returns/.test(text)) return [state.stock.returned];
        throw new Error(`SQL tak dikenal: ${text}`);
    }
};

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request === 'xlsx') return fakeXlsx;
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    if (request.endsWith('/helpers/dateHelper')) return { getWibDate: () => new Date(2026, 10, 5, 8, 5, 9) };
    return originalLoad.apply(this, arguments);
};

const { parseDeliveryOrderExportRequest } = require(path.join('..', 'services/delivery-order/deliveryOrderFilters'));
const { fetchExportData, MAX_EXPORT_ROWS } = require(path.join('..', 'services/delivery-order/deliveryOrderExportQuery'));
const wb = require(path.join('..', 'services/delivery-order/deliveryOrderExportWorkbook'));
const { exportDeliveryOrderExcel } = require(path.join('..', 'controllers/delivery-order/export/deliveryOrderExportController'));

test.beforeEach(() => {
    state.counts = [0, 0]; state.deliveries = []; state.returns = []; state.mappings = [];
    state.products = [{ id_product: 1, product_code: 'P1' }, { id_product: 2, product_code: 'P2' }];
    state.stock = { allocated: [], delivered: [], returned: [] }; state.lotQty = []; state.queries = []; state.dbError = null;
});

const deliveryRow = (o = {}) => ({
    do_number: 'DO1', do_datetime: '2026-10-01 08:00:00', product_code: 'P1', product_name: 'Produk 1', lot_number: 'L1',
    lot_completed_at: '2026-09-01 10:00:00', lot_expired_date: '2027-09-01', qty_pcs: '30', qty_ctn: '2.5', ...o
});
const returnRow = (o = {}) => ({
    return_number: 'RT1', return_datetime: '2026-10-05 09:00:00', product_code: 'P1', product_name: 'Produk 1', lot_number: 'L1', qty_pcs: '5', qty_ctn: '0.5', ...o
});

test('filter ekspor: pencarian untuk keduanya; rentang DO menyaring pengiriman, rentang Return menyaring retur', () => {
    const f = parseDeliveryOrderExportRequest({
        search: 'ab_c', fromDoDate: '2026-10-01', toDoDate: '2026-10-31',
        fromReturnDate: '2026-11-01', toReturnDate: '2026-11-30',
        fromCompletedDate: '2026-01-01', displayMode: 'BY_RETURN', page: '3'
    });
    assert.match(f.deliveries.whereSql, /d\.do_number LIKE \?/);
    assert.match(f.deliveries.whereSql, /dol\.do_datetime >= \?/);
    assert.match(f.returns.whereSql, /r\.return_number LIKE \?/);
    assert.match(f.returns.whereSql, /r\.return_datetime <= \?/);
    assert.equal(f.deliveries.params[0], '%ab\\_c%');
    assert.equal(f.returns.params[0], '%ab\\_c%');
    assert.deepEqual(f.deliveries.params.slice(-2), ['2026-10-01 00:00:00', '2026-10-31 23:59:59']);
    assert.deepEqual(f.returns.params.slice(-2), ['2026-11-01 00:00:00', '2026-11-30 23:59:59']);
    // rentang Completed tidak dipakai ekspor
    assert.ok(!/completed/.test(f.deliveries.whereSql + f.returns.whereSql));
});

test('filter ekspor: hanya rentang DO -> retur tidak tersaring tanggal; hanya rentang Return -> pengiriman tidak tersaring', () => {
    const onlyDo = parseDeliveryOrderExportRequest({ fromDoDate: '2026-10-01' });
    assert.deepEqual(onlyDo.deliveries.params, ['2026-10-01 00:00:00']);
    assert.equal(onlyDo.returns.whereSql, '1 = 1');
    assert.deepEqual(onlyDo.returns.params, []);

    const onlyReturn = parseDeliveryOrderExportRequest({ toReturnDate: '2026-11-30' });
    assert.equal(onlyReturn.deliveries.whereSql, '1 = 1');
    assert.deepEqual(onlyReturn.returns.params, ['2026-11-30 23:59:59']);
});

test('filter ekspor: tanpa filter, dan tanggal salah ditolak', () => {
    const f = parseDeliveryOrderExportRequest({});
    assert.equal(f.deliveries.whereSql, '1 = 1');
    assert.deepEqual(f.returns.params, []);
    assert.throws(() => parseDeliveryOrderExportRequest({ fromDoDate: '2026-11-01', toDoDate: '2026-10-01' }), (e) => e.status === 400);
    assert.throws(() => parseDeliveryOrderExportRequest({ fromDoDate: 'xx' }), (e) => e.status === 400);
    assert.throws(() => parseDeliveryOrderExportRequest({ fromReturnDate: '2026-11-01', toReturnDate: '2026-10-01' }), (e) => e.status === 400);
});

test('query: hitung dulu; di atas batas ditolak 400 tanpa membaca data', async () => {
    state.counts = [MAX_EXPORT_ROWS, 1];
    const filters = parseDeliveryOrderExportRequest({});
    await assert.rejects(() => fetchExportData(fakeDb, filters), (e) => e.status === 400 && /Too many rows/.test(e.message));
    assert.equal(state.queries.length, 2);
});

test('tanpa data: hanya query hitung dan hasil kosong', async () => {
    const data = await fetchExportData(fakeDb, parseDeliveryOrderExportRequest({}));
    assert.deepEqual(data, { deliveries: [], returns: [], lotBalance: [] });
    assert.equal(state.queries.length, 2);
});

test('query: pengiriman dikelompokkan per DO + item + lot, memakai filter dan parameter yang sama', async () => {
    state.counts = [1, 1]; state.deliveries = [deliveryRow()]; state.returns = [returnRow()];
    state.stock = {
        allocated: [{ product_code: 'P1', lot_number: 'L1', total_qty: '100' }],
        delivered: [{ product_code: 'P1', lot_number: 'L1', total_qty: '60' }],
        returned: [{ product_code: 'P1', lot_number: 'L1', total_qty: '5' }]
    };
    state.lotQty = [{ lot_number: 'L1', item_code: 'P1', net_all: '120' }];
    const filters = parseDeliveryOrderExportRequest({ search: 'DO1' });
    const data = await fetchExportData(fakeDb, filters);

    const deliveryQuery = state.queries.find((q) => /^SELECT d\.do_number/.test(q.sql));
    assert.match(deliveryQuery.sql, /GROUP BY d\.id, d\.do_number, p\.id_product, p\.product_code, p\.product_name, dol\.lot_number/);
    assert.match(deliveryQuery.sql, /DATE_FORMAT\(MIN\(dol\.do_datetime\), '%Y-%m-%d %H:%i:%s'\)/);
    assert.deepEqual(deliveryQuery.params, filters.deliveries.params);
    const returnQuery = state.queries.find((q) => /^SELECT r\.return_number/.test(q.sql));
    assert.deepEqual(returnQuery.params, filters.returns.params);

    assert.equal(data.deliveries.length, 1);
    assert.equal(data.returns.length, 1);
    assert.deepEqual(data.lotBalance, [{
        product_code: 'P1', product_name: 'Nama P1', lot_number: 'L1', allocated_qty: 100, delivered_qty: 60, returned_qty: 5, lot_qty: 120
    }]);
});

test('saldo lot: kode lama dan pengganti satu keluarga digabung menjadi satu baris berkode kanonik', async () => {
    state.counts = [2, 0];
    state.deliveries = [deliveryRow({ product_code: 'P1' }), deliveryRow({ do_number: 'DO2', product_code: 'P2' })];
    state.mappings = [{ id_product_old: 1, id_product_new: 2 }];
    state.stock = {
        allocated: [{ product_code: 'P1', lot_number: 'L1', total_qty: '725' }, { product_code: 'P2', lot_number: 'L1', total_qty: '15680' }],
        delivered: [{ product_code: 'P2', lot_number: 'L1', total_qty: '100' }],
        returned: []
    };
    const data = await fetchExportData(fakeDb, parseDeliveryOrderExportRequest({}));
    assert.equal(data.lotBalance.length, 1);
    assert.equal(data.lotBalance[0].product_code, 'P1'); // id terkecil = kanonik
    assert.equal(data.lotBalance[0].allocated_qty, 16405);
    assert.equal(data.lotBalance[0].delivered_qty, 100);
});

test('saldo lot: Lot Qty dari produksi bersih; kode lama dan pengganti digabung, query hanya untuk lot yang tampil', async () => {
    state.counts = [2, 0];
    state.deliveries = [deliveryRow({ product_code: 'P1' }), deliveryRow({ do_number: 'DO2', product_code: 'P2' })];
    state.mappings = [{ id_product_old: 1, id_product_new: 2 }];
    state.lotQty = [{ lot_number: 'L1', item_code: 'P1', net_all: '500' }, { lot_number: 'L1', item_code: 'P2', net_all: '1000' }];
    const data = await fetchExportData(fakeDb, parseDeliveryOrderExportRequest({}));
    assert.equal(data.lotBalance.length, 1);
    assert.equal(data.lotBalance[0].lot_qty, 1500);

    const q = state.queries.find((x) => /FROM production_lot_upload_details/.test(x.sql));
    assert.match(q.sql, /upload_trans_types/);
    assert.match(q.sql, /u\.lot_number IN \(\?\)/);
    assert.deepEqual(q.params, [['L1']]);
});

test('saldo lot: lot tanpa data produksi -> Lot Qty 0', async () => {
    state.counts = [1, 0];
    state.deliveries = [deliveryRow()];
    const data = await fetchExportData(fakeDb, parseDeliveryOrderExportRequest({}));
    assert.equal(data.lotBalance[0].lot_qty, 0);
});

test('workbook: tiga sheet datar; sisa kuota = teralokasi - terkirim bersih (retur membukanya)', () => {
    const buffer = wb.buildExportWorkbookBuffer({
        deliveries: [deliveryRow()],
        returns: [returnRow()],
        lotBalance: [{ product_code: 'P1', product_name: 'Produk 1', lot_number: 'L1', allocated_qty: 100, delivered_qty: 60, returned_qty: 5, lot_qty: 120 }]
    });
    const { sheets } = JSON.parse(buffer.toString());
    assert.deepEqual(sheets.map((s) => s.name), ['Deliveries', 'Returns', 'Lot Balance']);
    assert.deepEqual(sheets[0].aoa[0], wb.DELIVERY_HEADERS);
    assert.deepEqual(sheets[1].aoa[0], wb.RETURN_HEADERS);
    assert.deepEqual(sheets[2].aoa[0], wb.LOT_BALANCE_HEADERS);

    const delivery = sheets[0].aoa[1];
    assert.equal(delivery[0], 'DO1');
    assert.equal(delivery[1].t, 'n');          // tanggal sungguhan, bukan teks
    assert.equal(delivery[6].z, 'yyyy-mm-dd'); // expired: hanya tanggal
    assert.equal(delivery[7], 30);
    assert.equal(delivery[8], 2.5);
    assert.deepEqual(sheets[2].aoa[1].slice(3), [100, 60, 5, 45, 120, 65]);
    assert.equal(sheets[2].filter.ref, 'A1:I2');
    assert.equal(sheets[0].filter.ref, 'A1:I2');
    // sheet pengiriman tidak membawa nilai tingkat lot
    assert.ok(!wb.DELIVERY_HEADERS.some((h) => /Allocated|Remaining|Delivered|Returned/.test(h)));
});

test('workbook: DO 100 lalu retur 100 pada alokasi 100 -> sisa kuota 100 lagi', () => {
    const rows = wb.buildLotBalanceRows([{ product_code: 'P1', product_name: 'Produk 1', lot_number: 'L1', allocated_qty: 100, delivered_qty: 100, returned_qty: 100 }]);
    assert.equal(rows[1][6], 100);
});

test('workbook: Stock Balance = Lot Qty - terkirim bersih; kolom lama tidak bergeser, Lot Qty kosong dianggap 0', () => {
    const rows = wb.buildLotBalanceRows([
        { product_code: 'P1', product_name: 'Produk 1', lot_number: 'L1', allocated_qty: 100, delivered_qty: 100, returned_qty: 44, lot_qty: 100 },
        { product_code: 'P1', product_name: 'Produk 1', lot_number: 'L2', allocated_qty: 10, delivered_qty: 0, returned_qty: 0 }
    ]);
    assert.deepEqual(wb.LOT_BALANCE_HEADERS.slice(0, 7), ['Product Code', 'Product Name', 'Lot Number', 'Allocated (Pcs)', 'Delivered (Pcs)', 'Returned (Pcs)', 'Remaining Quota (Pcs)']);
    assert.deepEqual(wb.LOT_BALANCE_HEADERS.slice(7), ['Lot Qty (Pcs)', 'Stock Balance (Pcs)']);
    assert.deepEqual(rows[1].slice(3), [100, 100, 44, 44, 100, 44]);
    assert.deepEqual(rows[2].slice(3), [10, 0, 0, 10, 0, 0]);
});

test('workbook: sisa kuota tidak negatif, sel kosong menjadi null, data kosong tetap punya header', () => {
    const rows = wb.buildLotBalanceRows([{ product_code: 'P1', product_name: '', lot_number: 'L1', allocated_qty: 10, delivered_qty: 12, returned_qty: 0 }]);
    assert.equal(rows[1][1], null);
    assert.equal(rows[1][6], 0);
    const empty = JSON.parse(wb.buildExportWorkbookBuffer({ deliveries: [], returns: [], lotBalance: [] }).toString());
    assert.equal(empty.sheets[0].aoa.length, 1);
    assert.equal(empty.sheets[0].filter.ref, 'A1:I1');
});

test('nama file memakai waktu WIB', () => {
    assert.equal(wb.buildExportFileName(new Date(2026, 10, 5, 8, 5, 9)), 'Export_Delivery_Order_20261105_080509.xlsx');
});

const makeRes = () => {
    const res = { headers: {}, statusCode: null, body: null, ended: null };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    res.end = (b) => { res.ended = b; return res; };
    return res;
};

test('controller: mengirim xlsx dengan header unduhan', async () => {
    state.counts = [1, 0]; state.deliveries = [deliveryRow()];
    const res = makeRes();
    await exportDeliveryOrderExcel({ query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.equal(res.headers['Content-Disposition'], 'attachment; filename="Export_Delivery_Order_20261105_080509.xlsx"');
    assert.equal(res.headers['Access-Control-Expose-Headers'], 'Content-Disposition');
    assert.equal(res.headers['Content-Length'], res.ended.length);
});

test('controller: filter salah dan batas baris menjadi 400 dengan pesan; kegagalan database menjadi 500', async () => {
    let res = makeRes();
    await exportDeliveryOrderExcel({ query: { fromDoDate: 'xx' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);

    state.counts = [MAX_EXPORT_ROWS + 1, 0];
    res = makeRes();
    await exportDeliveryOrderExcel({ query: {} }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Too many rows/);

    state.counts = [1, 0]; state.dbError = new Error('db down');
    res = makeRes();
    const originalError = console.error; console.error = () => {};
    try { await exportDeliveryOrderExcel({ query: {} }, res); } finally { console.error = originalError; }
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
});
