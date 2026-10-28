'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const svc = require('../services/product-code-mapping/productCodeMappingService');

const makeConn = (over = {}) => {
    const calls = [];
    const st = {
        products: [{ id_product: 1 }, { id_product: 2 }],
        pairs: [],
        mapping: { id: 7, id_product_old: 1, id_product_new: 2 },
        insertId: 55,
        insertError: null,
        count: 2,
        rows: [],
        ...over
    };
    return {
        calls,
        query: async (sql, params) => {
            const s = sql.replace(/\s+/g, ' ').trim();
            calls.push({ sql: s, params });
            if (/^SELECT id_product FROM products WHERE id_product IN/.test(s)) return [st.products];
            if (/^SELECT id_product_old, id_product_new FROM product_code_mappings$/.test(s)) return [st.pairs];
            if (/^INSERT INTO product_code_mappings/.test(s)) {
                if (st.insertError) throw st.insertError;
                return [{ insertId: st.insertId }];
            }
            if (/FROM product_code_mappings WHERE id = \? FOR UPDATE/.test(s)) return [[st.mapping]];
            if (/^SELECT COUNT\(\*\)/.test(s)) return [[{ total: st.count }]];
            if (/^SELECT m\.id/.test(s)) return [st.rows];
            return [{}];
        }
    };
};
const find = (c, re) => c.calls.filter((x) => re.test(x.sql));

test('parseProductId / parseMappingId: bilangan bulat positif', () => {
    assert.equal(svc.parseProductId('12', 'old product'), 12);
    assert.equal(svc.parseProductId(12, 'old product'), 12);
    assert.equal(svc.parseMappingId('3'), 3);
    for (const bad of [undefined, null, '', '0', '-1', '1.5', 'abc', 1.5, {}, []]) {
        assert.throws(() => svc.parseProductId(bad, 'old product'), (e) => e.status === 400 && /A valid old product is required/.test(e.message), String(bad));
    }
    assert.throws(() => svc.parseMappingId('x'), (e) => e.status === 400 && /Mapping ID/.test(e.message));
});

test('createMapping: sukses menyimpan pasangan dan mencatat riwayat CREATE', async () => {
    const c = makeConn();
    const out = await svc.createMapping(c, { idProductOld: 1, idProductNew: 2, userId: 4 });
    assert.deepEqual(out, { id: 55, id_product_old: 1, id_product_new: 2 });
    assert.deepEqual(find(c, /^INSERT INTO product_code_mappings/)[0].params, [1, 2, 4]);
    assert.deepEqual(find(c, /product_code_mapping_logs/)[0].params, [55, 1, 2, 'CREATE', 4]);
});

test('createMapping: produk ke dirinya sendiri 400 sebelum akses database', async () => {
    const c = makeConn();
    await assert.rejects(svc.createMapping(c, { idProductOld: 1, idProductNew: 1, userId: 4 }), (e) => e.status === 400 && /itself/.test(e.message));
    assert.equal(c.calls.length, 0);
});

test('createMapping: produk lama/baru tidak ada -> 404 yang menyebut sisinya', async () => {
    await assert.rejects(svc.createMapping(makeConn({ products: [{ id_product: 2 }] }), { idProductOld: 1, idProductNew: 2, userId: 4 }),
        (e) => e.status === 404 && /Old product not found/.test(e.message));
    await assert.rejects(svc.createMapping(makeConn({ products: [{ id_product: 1 }] }), { idProductOld: 1, idProductNew: 2, userId: 4 }),
        (e) => e.status === 404 && /New product not found/.test(e.message));
});

test('createMapping: sudah sekeluarga (langsung, terbalik, atau lewat rantai) -> 409 tanpa tulis', async () => {
    const cases = [
        [{ id_product_old: 1, id_product_new: 2 }],
        [{ id_product_old: 2, id_product_new: 1 }],
        [{ id_product_old: 1, id_product_new: 9 }, { id_product_old: 9, id_product_new: 2 }]
    ];
    for (const pairs of cases) {
        const c = makeConn({ pairs });
        await assert.rejects(svc.createMapping(c, { idProductOld: 1, idProductNew: 2, userId: 4 }), (e) => e.status === 409 && /already linked/.test(e.message));
        assert.equal(find(c, /^INSERT/).length, 0);
    }
});

test('createMapping: menyambung dua keluarga berbeda diperbolehkan', async () => {
    const c = makeConn({ pairs: [{ id_product_old: 1, id_product_new: 8 }, { id_product_old: 2, id_product_new: 9 }] });
    await assert.doesNotReject(svc.createMapping(c, { idProductOld: 1, idProductNew: 2, userId: 4 }));
});

test('createMapping: ER_DUP_ENTRY (balapan) menjadi 409; error lain dilempar apa adanya', async () => {
    const dup = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
    await assert.rejects(svc.createMapping(makeConn({ insertError: dup }), { idProductOld: 1, idProductNew: 2, userId: 4 }), (e) => e.status === 409);
    const other = new Error('boom');
    await assert.rejects(svc.createMapping(makeConn({ insertError: other }), { idProductOld: 1, idProductNew: 2, userId: 4 }), (e) => e === other);
});

test('deleteMapping: mengunci baris, menghapus, mencatat riwayat DELETE; tidak ada -> 404', async () => {
    const c = makeConn();
    const out = await svc.deleteMapping(c, { mappingId: 7, userId: 4 });
    assert.deepEqual(out, { id: 7 });
    assert.equal(find(c, /FOR UPDATE/).length, 1);
    assert.deepEqual(find(c, /^DELETE FROM product_code_mappings/)[0].params, [7]);
    assert.deepEqual(find(c, /product_code_mapping_logs/)[0].params, [7, 1, 2, 'DELETE', 4]);

    const none = makeConn({ mapping: undefined });
    await assert.rejects(svc.deleteMapping(none, { mappingId: 7, userId: 4 }), (e) => e.status === 404);
    assert.equal(find(none, /^DELETE/).length, 0);
});

test('listMappings: pencarian ber-escape, halaman, dan bentuk hasil', async () => {
    const rows = [{
        id: 7, created_at: '2026-10-27 10:00:00', created_by_name: 'Admin',
        old_id: 1, old_code: 'FG-OLD', old_name: 'Lama', old_active: 0,
        new_id: 2, new_code: 'FG-NEW', new_name: 'Baru', new_active: 1
    }];
    const c = makeConn({ rows, count: 23 });
    const out = await svc.listMappings(c, { search: '50%_', page: 2, limit: 10, offset: 10 });

    assert.deepEqual(out.pagination, { totalItems: 23, totalPages: 3, currentPage: 2, limit: 10 });
    assert.deepEqual(out.data[0], {
        id: 7,
        old_product: { id_product: 1, product_code: 'FG-OLD', product_name: 'Lama', is_active: false },
        new_product: { id_product: 2, product_code: 'FG-NEW', product_name: 'Baru', is_active: true },
        created_by_name: 'Admin',
        created_at: '2026-10-27 10:00:00'
    });
    const page = find(c, /^SELECT m\.id/)[0];
    assert.deepEqual(page.params, ['%50\\%\\_%', '%50\\%\\_%', '%50\\%\\_%', '%50\\%\\_%', 10, 10]);
    assert.match(page.sql, /ORDER BY m\.id DESC LIMIT \? OFFSET \?/);
    assert.deepEqual(find(c, /^SELECT COUNT/)[0].params.length, 4);
});

test('listMappings: tanpa pencarian tidak ada kondisi WHERE', async () => {
    const c = makeConn({ count: 0 });
    const out = await svc.listMappings(c, { search: '', page: 1, limit: 10, offset: 0 });
    assert.deepEqual(out.data, []);
    assert.equal(out.pagination.totalPages, 0);
    assert.ok(!/WHERE/.test(find(c, /^SELECT COUNT/)[0].sql));
    assert.deepEqual(find(c, /^SELECT m\.id/)[0].params, [10, 0]);
});
