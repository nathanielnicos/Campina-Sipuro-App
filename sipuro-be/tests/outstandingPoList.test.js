'use strict';

/**
 * Tes daftar Outstanding PO: penyusun query (helpers/outstanding-po/outstandingQueryHelper.js)
 * dan controller daftar. Memakai database tiruan. Jalankan dengan: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const dbStub = { sipuroDb: { query: async () => [[]] } };

const originalLoad = Module._load;
Module._load = function patchedLoad(request) {
    if (request.endsWith('/config/db')) return dbStub;
    return originalLoad.apply(this, arguments);
};

const { buildListQuery } = require('../helpers/outstanding-po/outstandingQueryHelper');
const { getOutstandingList } = require('../controllers/outstanding-po/outstandingListController');

const CUSTOMER = { type: 'CUSTOMER', customerId: 7 };
const PPIC = { type: 'EMPLOYEE', role: 'STAFF', department: 'PPIC' };

const makeRes = () => {
    const res = { statusCode: 200, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    return res;
};

const placeholderCount = (sql) => (sql.match(/\?/g) || []).length;

test('penyusun query: customer disaring dari token, urutan klausa sama dengan urutan parameter', () => {
    const built = buildListQuery({
        status: 'Active', searchProduct: 'FG', searchPo: 'PO-1',
        fromCreatedDate: '2026-01-01', toCreatedDate: '2026-01-31',
        customer_id: '99', customerId: '99'
    }, CUSTOMER);

    assert.deepEqual(built.params, [7, 'Active', '%FG%', '%FG%', '%PO-1%', '2026-01-01 00:00:00', '2026-01-31 23:59:59']);
    assert.equal(placeholderCount(built.whereSql), built.params.length);
    const positions = ['h.customer_id = ?', 'd.status = ?', 'p.product_code LIKE ?', 'h.po_number LIKE ?', 'h.created_at >= ?', 'h.created_at <= ?']
        .map((fragment) => built.whereSql.indexOf(fragment));
    assert.ok(positions.every((i) => i >= 0));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('penyusun query: PPIC tanpa penyaringan customer; customer tanpa customerId atau tanpa user ditolak 403', () => {
    const built = buildListQuery({}, PPIC);
    assert.ok(!built.whereSql.includes('h.customer_id'));
    assert.deepEqual(built.params, []);

    for (const user of [{ type: 'CUSTOMER' }, undefined, null]) {
        assert.throws(() => buildListQuery({}, user), (error) => error.status === 403);
    }
});

test('penyusun query: kondisi dasar (PO Approved; item berjalan belum terpenuhi atau item yang sudah di-close)', () => {
    const { whereSql } = buildListQuery({}, PPIC);
    assert.ok(whereSql.includes('d.deleted_at IS NULL'));
    assert.ok(whereSql.includes("h.status = 'Approved'"));
    assert.ok(whereSql.includes("d.status IN ('Active', 'Close Requested') AND IFNULL(d.fulfilled_qty, 0) < d.base_qty"));
    assert.ok(whereSql.includes("d.status IN ('Closed', 'Partially Closed')"));
});

test('penyusun query: status tidak dikenal, tanggal tidak valid, dan rentang terbalik ditolak 400', () => {
    for (const query of [
        { status: 'Hacked' },
        { fromCreatedDate: '2026-13-01' },
        { toCreatedDate: '2026-02-30' },
        { fromCreatedDate: 'kemarin' },
        { fromCreatedDate: '2026-02-01', toCreatedDate: '2026-01-01' }
    ]) {
        assert.throws(() => buildListQuery(query, PPIC), (error) => error.status === 400, JSON.stringify(query));
    }
    for (const status of ['Active', 'Close Requested', 'Closed', 'Partially Closed']) {
        assert.deepEqual(buildListQuery({ status }, PPIC).params, [status]);
    }
});

test('penyusun query: nilai bukan teks diabaikan, karakter khusus LIKE di-escape', () => {
    const built = buildListQuery({ searchProduct: ['a', 'b'], searchPo: { x: 1 }, status: ['Active'] }, PPIC);
    assert.deepEqual(built.params, []);

    const escaped = buildListQuery({ searchProduct: '50%_\\' }, PPIC);
    assert.deepEqual(escaped.params, ['%50\\%\\_\\\\%', '%50\\%\\_\\\\%']);
});

test('penyusun query: limit maksimum 100, halaman dan offset, nilai tidak valid kembali ke bawaan', () => {
    const cases = [
        [{ limit: '100000' }, 100], [{ limit: '100' }, 100], [{ limit: '101' }, 100], [{ limit: '25' }, 25],
        [{ limit: '0' }, 10], [{ limit: 'abc' }, 10], [{ limit: '-5' }, 10], [{}, 10]
    ];
    for (const [query, expected] of cases) {
        assert.equal(buildListQuery(query, PPIC).limit, expected, JSON.stringify(query));
    }
    const paged = buildListQuery({ page: '3', limit: '20' }, PPIC);
    assert.equal(paged.page, 3);
    assert.equal(paged.offset, 40);
    assert.equal(buildListQuery({ page: '-2' }, PPIC).page, 1);
});

test('penyusun query: urutan punya pembeda, kunci tak dikenal (termasuk nama bawaan objek) kembali ke bawaan', () => {
    assert.equal(buildListQuery({ sortKey: 'total_po_count', sortOrder: 'desc' }, PPIC).orderBySql,
        'ORDER BY total_po_count DESC, p.id_product ASC');
    assert.equal(buildListQuery({ sortKey: 'total_produced_qty' }, PPIC).orderBySql,
        'ORDER BY total_produced_qty ASC, p.id_product ASC');
    for (const sortKey of ['p.product_code; DROP TABLE x', 'constructor', '__proto__', 'toString']) {
        const { orderBySql } = buildListQuery({ sortKey, sortOrder: 'asc' }, PPIC);
        assert.equal(orderBySql, 'ORDER BY p.product_code ASC, p.id_product ASC', sortKey);
    }
});

const mockQueries = ({ total, products, items }) => {
    const calls = [];
    dbStub.sipuroDb.query = async (sql, params) => {
        calls.push({ sql, params });
        if (/COUNT\(\*\) AS total/.test(sql)) return [[{ total }]];
        if (/GROUP BY p\.id_product, p\.product_code/.test(sql)) return [products];
        return [items];
    };
    return calls;
};

test('controller: merakit po_items per produk dari query kedua (tanpa GROUP_CONCAT)', async () => {
    const calls = mockQueries({
        total: 2,
        products: [
            { id_product: 1, product_code: 'FG-1', product_name: 'Satu', total_required_qty: '1500', total_produced_qty: '400', total_remaining_qty: '600', total_po_count: '2' },
            { id_product: 2, product_code: 'FG-2', product_name: 'Dua', total_required_qty: '100', total_produced_qty: '0', total_remaining_qty: '0', total_po_count: '1' }
        ],
        items: [
            { po_detail_id: 10, po_header_id: 1, id_product: 1, po_number: 'PO-A', created_date: '2026-10-01', required_qty: '1000', produced_qty: '400', remaining_qty: '0', status: 'Partially Closed', close_reason: 'lama' },
            { po_detail_id: 11, po_header_id: 2, id_product: 1, po_number: 'PO-B', created_date: '2026-10-02', required_qty: '500', produced_qty: '0', remaining_qty: '500', status: 'Close Requested', close_reason: 'tidak jadi' },
            { po_detail_id: 12, po_header_id: 3, id_product: 2, po_number: 'PO-C', created_date: '2026-10-03', required_qty: '100', produced_qty: '0', remaining_qty: '0', status: 'Closed', close_reason: 'sisa' }
        ]
    });
    const res = makeRes();
    await getOutstandingList({ user: PPIC, query: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 3);
    for (const call of calls) {
        assert.ok(!/GROUP_CONCAT/i.test(call.sql));
        assert.equal(placeholderCount(call.sql), call.params.length);
    }
    assert.deepEqual(calls[2].params, [[1, 2]]);

    const [first, second] = res.body.data;
    assert.equal(first.total_required_qty, 1500);
    assert.equal(first.total_produced_qty, 400);
    assert.equal(first.total_remaining_qty, 600);
    assert.equal(first.total_po_count, 2);
    assert.deepEqual(first.po_items.map((i) => i.po_number), ['PO-A', 'PO-B']);
    assert.equal(first.po_items[0].required_qty, 1000);
    assert.equal(first.po_items[0].remaining_qty, 0);
    // Alasan hanya dikirim untuk pengajuan yang masih menunggu keputusan.
    assert.equal(first.po_items[0].close_reason, null);
    assert.equal(first.po_items[1].close_reason, 'tidak jadi');
    assert.deepEqual(second.po_items.map((i) => i.status), ['Closed']);
    assert.deepEqual(res.body.pagination, { totalItems: 2, totalPages: 1, currentPage: 1, limit: 10 });
});

test('controller: customer disaring pada ketiga query dan tidak bisa diganti lewat request', async () => {
    const calls = mockQueries({
        total: 1,
        products: [{ id_product: 1, product_code: 'FG-1', product_name: 'Satu', total_required_qty: '1', total_produced_qty: '0', total_remaining_qty: '1', total_po_count: '1' }],
        items: []
    });
    const res = makeRes();
    await getOutstandingList({ user: CUSTOMER, query: { customer_id: '99', customerId: '99' } }, res);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0].params, [7]);
    assert.deepEqual(calls[1].params, [7]);
    assert.deepEqual(calls[2].params, [7, [1]]);
});

test('controller: tanpa data hanya menjalankan query hitung; halaman melewati batas mengembalikan daftar kosong', async () => {
    let calls = mockQueries({ total: 0, products: [], items: [] });
    let res = makeRes();
    await getOutstandingList({ user: PPIC, query: {} }, res);
    assert.equal(calls.length, 1);
    assert.deepEqual(res.body, { success: true, data: [], pagination: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 10 } });

    calls = mockQueries({ total: 5, products: [], items: [] });
    res = makeRes();
    await getOutstandingList({ user: PPIC, query: { page: '9' } }, res);
    assert.equal(calls.length, 2);
    assert.deepEqual(res.body.data, []);
});

test('controller: parameter tidak valid menjawab 400, customer tanpa customerId 403, tanpa query ke database', async () => {
    const calls = mockQueries({ total: 0, products: [], items: [] });
    let res = makeRes();
    await getOutstandingList({ user: PPIC, query: { status: 'Hacked' } }, res);
    assert.equal(res.statusCode, 400);
    res = makeRes();
    await getOutstandingList({ user: { type: 'CUSTOMER' }, query: {} }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(calls.length, 0);
});

test('controller: error database dijawab 500 generik tanpa detail SQL', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    dbStub.sipuroDb.query = async () => { throw new Error('rahasia: detail SQL'); };
    try {
        const res = makeRes();
        await getOutstandingList({ user: PPIC, query: {} }, res);
        assert.equal(res.statusCode, 500);
        assert.equal(res.body.success, false);
        assert.ok(!JSON.stringify(res.body).includes('rahasia'));
    } finally {
        console.error = originalConsoleError;
    }
});
