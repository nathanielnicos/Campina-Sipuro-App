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
    write: (wb, opts) => Buffer.from(JSON.stringify({ opts, sheets: wb.sheets.map((s) => ({ name: s.name, aoa: s.sheet.__aoa, cols: s.sheet['!cols'], filter: s.sheet['!autofilter'] })) }))
};

const state = { replies: [], queries: [], dbError: null };
const fakeDb = {
    query: async (sql, params) => {
        state.queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
        if (state.dbError) throw state.dbError;
        return [state.replies.shift() || []];
    }
};

const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request === 'xlsx') return fakeXlsx;
    if (request.endsWith('/config/db')) return { sipuroDb: fakeDb };
    if (request.endsWith('/helpers/dateHelper')) return { getWibDate: () => new Date(2026, 9, 27, 8, 5, 9) };
    return originalLoad.apply(this, arguments);
};

const { fetchExportData, MAX_EXPORT_ROWS } = require(path.join('..', 'services/production-lot/lotExportQuery'));
const wb = require(path.join('..', 'services/production-lot/lotExportWorkbook'));
const { exportLotMappingExcel } = require(path.join('..', 'controllers/production-lot/export/lotExportController'));

test.beforeEach(() => { state.replies = []; state.queries = []; state.dbError = null; });

const alloc = (o = {}) => ({
    product_code: 'P1', product_name: 'Produk 1', po_number: 'PO1', po_created_at: '2026-01-01 08:00:00',
    batch_number: 'B1', lot_number: 'L1', lot_completed_at: '2026-02-01 10:00:00', lot_expired_date: '2027-02-01',
    allocated_qty: '30', allocation_status: 'Open', lot_product_code: 'P1', via_mapping: 0, ...o
});
const item = (o = {}) => ({
    po_number: 'PO1', po_created_at: '2026-01-01 08:00:00', product_code: 'P1', product_name: 'Produk 1', base_qty: '100', total_allocated: '70', ...o
});

test('query: hitung dulu, lalu dua query dengan filter dan parameter yang sama', async () => {
    state.replies = [[{ total: 2 }], [alloc()], [item()]];
    const filters = { whereSql: 'd.deleted_at IS NULL AND pla.status = ?', params: ['Open'] };
    const data = await fetchExportData(fakeDb, filters);
    assert.equal(state.queries.length, 3);
    for (const q of state.queries) {
        assert.match(q.sql, /FROM po_lot_allocations pla/);
        assert.match(q.sql, /JOIN batches b ON pla\.id_batch = b\.id/);
        assert.match(q.sql, /pla\.status = \?/);
        assert.deepEqual(q.params, ['Open']);
        assert.doesNotMatch(q.sql, /batch_lots/);
    }
    assert.equal(data.allocations.length, 1);
    assert.equal(data.poItems.length, 1);
});

test('query alokasi: satu baris per alokasi; query item PO dikelompokkan per item dan memakai rumus total teralokasi bersama', async () => {
    state.replies = [[{ total: 1 }], [], []];
    await fetchExportData(fakeDb, { whereSql: 'x', params: [] });
    assert.doesNotMatch(state.queries[1].sql, /GROUP BY/);
    assert.match(state.queries[2].sql, /GROUP BY d\.po_detail_id/);
    assert.match(state.queries[2].sql, /pla\.status <> 'Canceled'/);
    assert.match(state.queries[1].sql, /DATE_FORMAT\(h\.created_at, '%Y-%m-%d %H:%i:%s'\)/);
});

test('tanpa data: hanya query hitung dan hasil kosong', async () => {
    state.replies = [[{ total: 0 }]];
    const data = await fetchExportData(fakeDb, { whereSql: 'x', params: [] });
    assert.deepEqual(data, { allocations: [], poItems: [] });
    assert.equal(state.queries.length, 1);
});

test('melebihi batas baris ditolak 400 sebelum mengambil data', async () => {
    state.replies = [[{ total: MAX_EXPORT_ROWS + 1 }]];
    await assert.rejects(fetchExportData(fakeDb, { whereSql: 'x', params: [] }), (e) => e.status === 400 && /narrow the filters/.test(e.message));
    assert.equal(state.queries.length, 1);

    state.queries = []; state.replies = [[{ total: MAX_EXPORT_ROWS }], [], []];
    await assert.doesNotReject(fetchExportData(fakeDb, { whereSql: 'x', params: [] }));
});

test('judul kolom kedua sheet persis sesuai kesepakatan', () => {
    assert.deepEqual(wb.ALLOCATION_HEADERS, [
        'Product Code', 'Product Name', 'PO Number', 'PO Created Date', 'Batch Number', 'Lot Number',
        'Lot Completed Date', 'Lot Expired Date', 'Allocated Qty (Pcs)', 'Allocation Status', 'Lot Product Code', 'Via Mapping'
    ]);
    assert.deepEqual(wb.PO_ITEM_HEADERS, [
        'PO Number', 'PO Created Date', 'Product Code', 'Product Name',
        'PO Qty (Pcs)', 'Total Allocated (Pcs)', 'Remaining (Pcs)', 'Fulfillment %'
    ]);
});

test('sheet Allocations: kolom tingkat alokasi saja, tanpa qty/sisa/persen tingkat PO', () => {
    const rows = wb.buildAllocationRows([alloc()]);
    assert.deepEqual(rows[0], wb.ALLOCATION_HEADERS);
    for (const forbidden of ['PO Qty (Pcs)', 'Remaining (Pcs)', 'Fulfillment %', 'Total Allocated (Pcs)']) {
        assert.ok(!wb.ALLOCATION_HEADERS.includes(forbidden), forbidden);
    }
    const r = rows[1];
    assert.equal(r.length, wb.ALLOCATION_HEADERS.length);
    assert.equal(r[8], 30);
    assert.equal(typeof r[8], 'number');
    assert.equal(r[3].t, 'n');
    assert.equal(r[7].z, 'yyyy-mm-dd');
    assert.equal(r[9], 'Open');
});

test('nilai kosong menjadi sel kosong (bukan tanda "-" yang merusak filter tanggal/pivot)', () => {
    const r = wb.buildAllocationRows([alloc({ lot_completed_at: null, lot_expired_date: null, batch_number: '' })])[1];
    assert.equal(r[4], null);
    assert.equal(r[6], null);
    assert.equal(r[7], null);
});

test('tidak ada nilai digabung koma pada data', () => {
    const rows = wb.buildAllocationRows([alloc(), alloc({ lot_number: 'L2' })]).slice(1);
    for (const r of rows) for (const cell of r) if (typeof cell === 'string') assert.ok(!cell.includes(', '), cell);
});

test('sheet PO Items: sisa, persen, dan batas bawah nol', () => {
    const rows = wb.buildPoItemRows([item(), item({ po_number: 'PO2', base_qty: '10', total_allocated: '12' }), item({ po_number: 'PO3', base_qty: '0', total_allocated: '0' })]);
    assert.deepEqual(rows[0], wb.PO_ITEM_HEADERS);
    assert.deepEqual(rows[1].slice(4, 7), [100, 70, 30]);
    assert.equal(rows[1][7].v, 0.7);
    assert.equal(rows[1][7].z, '0.0%');
    assert.equal(rows[2][6], 0);
    assert.equal(rows[3][7].v, 0);
});

test('simulasi pivot: jumlah Allocated Qty per item PO sama dengan Total Allocated di sheet PO Items', async () => {
    // PO1/P1 punya dua alokasi (lot yang sama di dua batch) dan satu lagi di lot lain; PO2/P2 satu alokasi
    const allocations = [
        alloc({ po_number: 'PO1', batch_number: 'B1', lot_number: 'L1', allocated_qty: '30' }),
        alloc({ po_number: 'PO1', batch_number: 'B2', lot_number: 'L1', allocated_qty: '40' }),
        alloc({ po_number: 'PO1', batch_number: 'B3', lot_number: 'L2', allocated_qty: '10' }),
        alloc({ po_number: 'PO2', product_code: 'P2', product_name: 'Produk 2', batch_number: 'B4', lot_number: 'L3', allocated_qty: '5' })
    ];
    const poItems = [
        item({ po_number: 'PO1', product_code: 'P1', base_qty: '100', total_allocated: '80' }),
        item({ po_number: 'PO2', product_code: 'P2', product_name: 'Produk 2', base_qty: '50', total_allocated: '5' })
    ];
    const allocRows = wb.buildAllocationRows(allocations).slice(1);
    const itemRows = wb.buildPoItemRows(poItems).slice(1);

    const pivot = new Map();
    allocRows.forEach((r) => {
        const key = `${r[2]}|${r[0]}`;
        pivot.set(key, (pivot.get(key) || 0) + r[8]);
    });
    itemRows.forEach((r) => assert.equal(pivot.get(`${r[0]}|${r[2]}`), r[5], `${r[0]}|${r[2]}`));

    // Total seluruh sheet Allocations = total teralokasi (tidak ada hitung ganda)
    const sumAlloc = allocRows.reduce((s, r) => s + r[8], 0);
    const sumItems = itemRows.reduce((s, r) => s + r[5], 0);
    assert.equal(sumAlloc, sumItems);

    // Setiap kombinasi (PO, produk, batch, lot) hanya sekali
    const keys = allocRows.map((r) => `${r[2]}|${r[0]}|${r[4]}|${r[5]}`);
    assert.equal(new Set(keys).size, keys.length);
});

test('workbook: dua sheet bernama Allocations dan PO Items, lebar kolom, filter otomatis', () => {
    const buf = wb.buildExportWorkbookBuffer({ allocations: [alloc(), alloc()], poItems: [item()] });
    const parsed = JSON.parse(buf.toString());
    assert.deepEqual(parsed.opts, { type: 'buffer', bookType: 'xlsx' });
    assert.deepEqual(parsed.sheets.map((s) => s.name), ['Allocations', 'PO Items']);
    assert.equal(parsed.sheets[0].aoa.length, 3);
    assert.equal(parsed.sheets[0].cols.length, 12);
    assert.deepEqual(parsed.sheets[0].filter, { ref: 'A1:L3' });
    assert.deepEqual(parsed.sheets[1].filter, { ref: 'A1:H2' });
});

test('workbook tanpa data tetap berisi baris judul', () => {
    const parsed = JSON.parse(wb.buildExportWorkbookBuffer({ allocations: [], poItems: [] }).toString());
    assert.equal(parsed.sheets[0].aoa.length, 1);
    assert.deepEqual(parsed.sheets[0].filter, { ref: 'A1:L1' });
});

test('nama file memakai waktu WIB', () => {
    assert.equal(wb.buildExportFileName(new Date(2026, 9, 27, 8, 5, 9)), 'Export_Lot_Mapping_20261027_080509.xlsx');
});

const run = async (query) => {
    const out = { status: 200, headers: {}, body: null, ended: null };
    const res = {
        setHeader(k, v) { out.headers[k] = v; },
        status(c) { out.status = c; return res; },
        json(b) { out.body = b; return res; },
        end(b) { out.ended = b; return res; }
    };
    await exportLotMappingExcel({ query }, res);
    return out;
};

test('controller: mengirim file xlsx dengan header unduhan', async () => {
    state.replies = [[{ total: 1 }], [alloc()], [item()]];
    const r = await run({ status: 'Open' });
    assert.equal(r.status, 200);
    assert.equal(r.headers['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.equal(r.headers['Content-Disposition'], 'attachment; filename="Export_Lot_Mapping_20261027_080509.xlsx"');
    assert.equal(r.headers['Access-Control-Expose-Headers'], 'Content-Disposition');
    assert.equal(r.headers['Content-Length'], r.ended.length);
    assert.deepEqual(state.queries[0].params, ['Open']);
});

test('controller: filter tidak valid 400 tanpa query; kelebihan baris 400; error database 500 generik', async () => {
    const bad = await run({ status: 'zzz' });
    assert.equal(bad.status, 400);
    assert.equal(state.queries.length, 0);

    state.replies = [[{ total: MAX_EXPORT_ROWS + 5 }]];
    assert.equal((await run({})).status, 400);

    state.dbError = new Error('secret table detail');
    const err = await run({});
    assert.equal(err.status, 500);
    assert.equal(err.body.message, 'Failed to export Excel data.');
    assert.ok(!JSON.stringify(err.body).includes('secret'));
});

test('kolom pemetaan: kode produk lot dan penanda Via Mapping (Yes/No)', () => {
    const rows = wb.buildAllocationRows([
        alloc(),
        alloc({ lot_product_code: 'P0', via_mapping: 1 }),
        alloc({ lot_product_code: null, via_mapping: '1' })
    ]);
    assert.deepEqual([rows[1][10], rows[1][11]], ['P1', 'No']);
    assert.deepEqual([rows[2][10], rows[2][11]], ['P0', 'Yes']);
    assert.deepEqual([rows[3][10], rows[3][11]], [null, 'Yes']);
});

test('query alokasi mengambil kode produk lot dan penanda lintas kode dari id produk', async () => {
    state.replies = [[{ total: 1 }], [], []];
    await fetchExportData(fakeDb, { whereSql: 'x', params: [] });
    assert.match(state.queries[1].sql, /lp\.product_code AS lot_product_code/);
    assert.match(state.queries[1].sql, /\(l\.id_product <> d\.id_product\) AS via_mapping/);
    assert.match(state.queries[1].sql, /JOIN products lp ON l\.id_product = lp\.id_product/);
});
