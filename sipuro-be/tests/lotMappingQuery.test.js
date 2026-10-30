'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchMappingPage, shapeByPo, shapeByBatch, shapeByLot } = require('../services/production-lot/lotMappingQuery');

const fakeDb = (replies) => {
    const calls = [];
    return {
        calls,
        query: async (sql, params) => {
            calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
            return [replies[calls.length - 1]];
        }
    };
};

const req = (over = {}) => ({ displayMode: 'BY_PO', whereSql: 'd.deleted_at IS NULL', params: [], limit: 10, offset: 0, order: 'DESC', sortKey: '', ...over });

test('tanpa data: hanya query hitung', async () => {
    const db = fakeDb([[{ total: 0 }]]);
    const r = await fetchMappingPage(db, req());
    assert.deepEqual(r, { data: [], totalItems: 0 });
    assert.equal(db.calls.length, 1);
});

test('halaman melewati batas: daftar kosong, total tetap', async () => {
    const db = fakeDb([[{ total: 5 }], []]);
    const r = await fetchMappingPage(db, req({ offset: 50 }));
    assert.deepEqual(r, { data: [], totalItems: 5 });
    assert.equal(db.calls.length, 2);
});

test('tiga langkah: hitung induk unik, halaman kunci (GROUP BY), lalu anak dengan IN kunci tersebut', async () => {
    const db = fakeDb([[{ total: 12 }], [{ page_key: 7 }, { page_key: 3 }], []]);
    await fetchMappingPage(db, req({ displayMode: 'BY_BATCH', params: ['x'], limit: 2, offset: 4, order: 'ASC' }));
    const [count, keys, detail] = db.calls;

    assert.match(count.sql, /COUNT\(DISTINCT b\.id\)/);
    assert.deepEqual(count.params, ['x']);

    assert.match(keys.sql, /GROUP BY b\.id ORDER BY b\.id ASC LIMIT \? OFFSET \?/);
    assert.deepEqual(keys.params, ['x', 2, 4]);

    assert.match(detail.sql, /AND b\.id IN \(\?\)/);
    assert.deepEqual(detail.params, ['x', [7, 3]]);

    for (const c of db.calls) {
        assert.match(c.sql, /FROM po_lot_allocations pla/);
        assert.match(c.sql, /JOIN batches b ON pla\.id_batch = b\.id/);
        assert.doesNotMatch(c.sql, /batch_lots/);
    }
});

test('BY_PO: halaman kunci tanpa DISTINCT+ORDER BY kolom lain; urut PO dibuat atau nomor PO', async () => {
    const a = fakeDb([[{ total: 1 }], [{ page_key: 1 }], []]);
    await fetchMappingPage(a, req());
    assert.match(a.calls[1].sql, /GROUP BY h\.po_header_id, h\.po_number, h\.created_at ORDER BY h\.created_at DESC, h\.po_header_id ASC/);
    assert.doesNotMatch(a.calls[1].sql, /DISTINCT/);

    const b = fakeDb([[{ total: 1 }], [{ page_key: 1 }], []]);
    await fetchMappingPage(b, req({ sortKey: 'po_number', order: 'ASC' }));
    assert.match(b.calls[1].sql, /ORDER BY h\.po_number ASC, h\.po_header_id ASC/);

    const c = fakeDb([[{ total: 1 }], [{ page_key: 1 }], []]);
    await fetchMappingPage(c, req({ sortKey: 'sembarang; DROP' }));
    assert.match(c.calls[1].sql, /ORDER BY h\.created_at DESC/);
});

test('BY_LOT: kunci nomor lot unik', async () => {
    const db = fakeDb([[{ total: 1 }], [{ page_key: 'L1' }], []]);
    await fetchMappingPage(db, req({ displayMode: 'BY_LOT' }));
    assert.match(db.calls[0].sql, /COUNT\(DISTINCT l\.lot_number\)/);
    assert.match(db.calls[1].sql, /GROUP BY l\.lot_number ORDER BY l\.lot_number DESC/);
    assert.match(db.calls[2].sql, /AND l\.lot_number IN \(\?\)/);
});

test('query detail tidak membaca actual_production_date batch', async () => {
    for (const displayMode of ['BY_PO', 'BY_BATCH', 'BY_LOT']) {
        const db = fakeDb([[{ total: 1 }], [{ page_key: 1 }], []]);
        await fetchMappingPage(db, req({ displayMode }));
        assert.doesNotMatch(db.calls[2].sql, /actual_production_date/);
    }
});

test('shapeByPo: PO -> item -> batch -> lot; persentase dan sisa dihitung; angka teks dibaca benar', () => {
    const row = (o) => ({
        po_header_id: 1, po_number: 'PO1', po_header_status: 'Approved', po_created_date: 'd',
        po_detail_id: 10, po_base_qty: '100', po_fulfilled_qty: '70', id_product: 1, product_code: 'P1', product_name: 'N',
        batch_id: 5, batch_number: 'B1', batch_status: 'Open', lot_id: 8, lot_number: 'L1',
        actual_completed_datetime: 'a', expired_date: 'e', allocation_id: 100, allocated_qty: '30', allocation_status: 'Open', ...o
    });
    const out = shapeByPo([row(), row({ allocation_id: 101, batch_id: 6, batch_number: 'B2', allocated_qty: '40' })]);
    assert.equal(out.length, 1);
    const product = out[0].products[0];
    assert.equal(product.remaining_qty, 30);
    assert.equal(product.fulfillment_percentage, 70);
    assert.deepEqual(product.batches.map((b) => [b.batch_number, b.lots[0].allocated_qty]), [['B1', 30], ['B2', 40]]);
});

test('shapeByPo: status item PO dan alasan close ikut dibawa (kosong menjadi null)', () => {
    const base = { po_header_id: 1, po_number: 'P', po_detail_id: 1, po_base_qty: 10, po_fulfilled_qty: 4, batch_id: 1, lot_id: 1, allocation_id: 1, allocated_qty: 1 };
    const closed = shapeByPo([{ ...base, po_item_status: 'Partially Closed', po_close_reason: 'Customer cancel' }])[0].products[0];
    assert.deepEqual([closed.item_status, closed.close_reason], ['Partially Closed', 'Customer cancel']);
    const none = shapeByPo([base])[0].products[0];
    assert.deepEqual([none.item_status, none.close_reason], [null, null]);
});

test('BY_PO: query detail membaca status item dan alasan close; mode lain tidak', async () => {
    const po = fakeDb([[{ total: 1 }], [{ page_key: 1 }], []]);
    await fetchMappingPage(po, req({ displayMode: 'BY_PO' }));
    assert.match(po.calls[2].sql, /d\.status AS po_item_status, d\.close_reason AS po_close_reason/);
    const batch = fakeDb([[{ total: 1 }], [{ page_key: 1 }], []]);
    await fetchMappingPage(batch, req({ displayMode: 'BY_BATCH' }));
    assert.doesNotMatch(batch.calls[2].sql, /po_item_status/);
});

test('shapeByPo: kelebihan alokasi tidak menghasilkan sisa negatif; qty dasar 0 tidak membagi nol', () => {
    const base = { po_header_id: 1, po_number: 'P', po_detail_id: 1, batch_id: 1, lot_id: 1, allocation_id: 1, allocated_qty: 1 };
    const over = shapeByPo([{ ...base, po_base_qty: 10, po_fulfilled_qty: 12 }])[0].products[0];
    assert.equal(over.remaining_qty, 0);
    const zero = shapeByPo([{ ...base, po_base_qty: 0, po_fulfilled_qty: 0 }])[0].products[0];
    assert.equal(zero.fulfillment_percentage, 0);
});

test('shapeByBatch: batch -> lot -> alokasi PO; tanggal selesai batch ikut; tanpa tanggal mulai', () => {
    const r = (o) => ({
        batch_id: 1, batch_number: 'B1', batch_status: 'Open', actual_completed_date: 'c', product_code: 'P1', product_name: 'N',
        lot_id: 2, lot_number: 'L1', actual_completed_datetime: 'a', expired_date: 'e', allocation_id: 1, allocated_qty: '5', allocation_status: 'Open', po_number: 'PO1', ...o
    });
    const out = shapeByBatch([r(), r({ allocation_id: 2, po_number: 'PO2' }), r({ lot_id: 3, lot_number: 'L2', allocation_id: 3 })]);
    assert.equal(out.length, 1);
    assert.equal(out[0].actual_completed_date, 'c');
    assert.ok(!('actual_production_date' in out[0]));
    assert.deepEqual(out[0].lots.map((l) => l.po_allocations.length), [2, 1]);
});

test('shapeByLot: lot yang sama di dua batch tampil per batch, tiap alokasi sekali (tidak dobel)', () => {
    const r = (o) => ({
        lot_number: 'L1', batch_id: 1, batch_number: 'B1', id_product: 1, product_code: 'P1', product_name: 'N',
        actual_completed_datetime: 'a', expired_date: 'e', allocation_id: 1, allocated_qty: '5', allocation_status: 'Open', po_number: 'PO1', ...o
    });
    const out = shapeByLot([r(), r({ batch_id: 2, batch_number: 'B2', allocation_id: 2, allocated_qty: '9' })]);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].batches.map((b) => [b.batch_number, b.allocations.length, b.allocations[0].allocated_qty]), [['B1', 1, 5], ['B2', 1, 9]]);
});

test('shapeByPo: lot membawa kode produk lot dan penanda lintas kode', () => {
    const base = {
        po_header_id: 1, po_number: 'PO1', po_detail_id: 10, po_base_qty: 100, po_fulfilled_qty: 0, id_product: 2, product_code: 'NEW',
        batch_id: 5, batch_number: 'B1', allocated_qty: 1, allocation_status: 'Open'
    };
    const out = shapeByPo([
        { ...base, lot_id: 1, lot_number: 'L1', allocation_id: 1, lot_product_code: 'NEW', lot_product_name: 'N', is_cross_code: '0' },
        { ...base, lot_id: 2, lot_number: 'L2', allocation_id: 2, lot_product_code: 'OLD', lot_product_name: 'O', is_cross_code: '1' }
    ]);
    const lots = out[0].products[0].batches[0].lots;
    assert.deepEqual(lots.map((l) => [l.lot_number, l.lot_product_code, l.is_cross_code]), [['L1', 'NEW', false], ['L2', 'OLD', true]]);
});

test('shapeByBatch / shapeByLot: alokasi membawa kode produk PO dan penanda lintas kode', () => {
    const b = shapeByBatch([{
        batch_id: 1, batch_number: 'B1', product_code: 'OLD', lot_id: 2, lot_number: 'L1', allocation_id: 1, allocated_qty: 5,
        allocation_status: 'Open', po_number: 'PO1', po_product_code: 'NEW', is_cross_code: 1
    }]);
    assert.equal(b[0].product_code, 'OLD');
    assert.deepEqual([b[0].lots[0].po_allocations[0].po_product_code, b[0].lots[0].po_allocations[0].is_cross_code], ['NEW', true]);

    const l = shapeByLot([{
        lot_number: 'L1', batch_id: 1, batch_number: 'B1', id_product: 1, product_code: 'OLD', allocation_id: 1, allocated_qty: 5,
        allocation_status: 'Open', po_number: 'PO1', po_product_code: 'NEW', is_cross_code: 0
    }]);
    assert.deepEqual([l[0].batches[0].product_code, l[0].batches[0].allocations[0].po_product_code, l[0].batches[0].allocations[0].is_cross_code], ['OLD', 'NEW', false]);
});

test('query daftar: produk lot (lp) dipakai untuk mode batch dan lot, produk PO untuk mode PO', async () => {
    const sqls = [];
    const db = { query: async (sql) => { sqls.push(sql.replace(/\s+/g, ' ')); return [[{ total: 1, page_key: 1 }]]; } };
    for (const displayMode of ['BY_PO', 'BY_BATCH', 'BY_LOT']) {
        sqls.length = 0;
        await fetchMappingPage(db, { displayMode, whereSql: 'x', params: [], limit: 10, offset: 0, order: 'DESC', sortKey: '' });
        const detail = sqls[sqls.length - 1];
        assert.match(detail, /JOIN products lp ON l\.id_product = lp\.id_product/);
        assert.match(detail, /\(l\.id_product <> d\.id_product\) AS is_cross_code/);
        if (displayMode === 'BY_PO') assert.match(detail, /lp\.product_code AS lot_product_code/);
        else assert.match(detail, /lp\.product_code, lp\.product_name, p\.product_code AS po_product_code/);
    }
});
