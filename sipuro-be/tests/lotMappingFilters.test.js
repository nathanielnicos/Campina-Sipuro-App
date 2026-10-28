'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    DISPLAY_MODES, MAPPING_FROM_SQL, buildMappingFilters, parseMappingRequest
} = require('../services/production-lot/lotMappingFilters');

test('FROM bersama: satu baris = satu alokasi, batch dari po_lot_allocations.id_batch, tanpa batch_lots', () => {
    assert.match(MAPPING_FROM_SQL, /FROM po_lot_allocations pla/);
    assert.match(MAPPING_FROM_SQL, /JOIN batches b ON pla\.id_batch = b\.id/);
    assert.match(MAPPING_FROM_SQL, /JOIN lots l ON pla\.lot_id = l\.id/);
    assert.match(MAPPING_FROM_SQL, /JOIN products lp ON l\.id_product = lp\.id_product/);
    assert.doesNotMatch(MAPPING_FROM_SQL, /batch_lots/);
});

test('tanpa filter: hanya item PO yang belum dihapus', () => {
    const f = buildMappingFilters({});
    assert.equal(f.whereSql, 'd.deleted_at IS NULL');
    assert.deepEqual(f.params, []);
});

test('pencarian: tujuh kolom (termasuk produk lot), karakter LIKE di-escape, urutan parameter sama dengan urutan klausa', () => {
    const f = buildMappingFilters({ search: ' 50%_ ', status: 'Open', fromCreatedDate: '2026-01-01' });
    assert.match(f.whereSql, /b\.batch_number LIKE \? OR l\.lot_number LIKE \? OR p\.product_code LIKE \? OR p\.product_name LIKE \? OR lp\.product_code LIKE \? OR lp\.product_name LIKE \? OR h\.po_number LIKE \?/);
    assert.deepEqual(f.params, [...Array(7).fill('%50\\%\\_%'), 'Open', '2026-01-01 00:00:00']);
    const order = ['LIKE', 'pla.status = ?', 'h.created_at >= ?'].map((t) => f.whereSql.indexOf(t));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('status hanya nilai yang dikenal', () => {
    for (const ok of ['Open', 'Closed', 'Canceled', 'Force Closed']) assert.doesNotThrow(() => buildMappingFilters({ status: ok }));
    assert.throws(() => buildMappingFilters({ status: 'open' }), (e) => e.status === 400);
    assert.throws(() => buildMappingFilters({ status: "x' OR 1=1" }), (e) => e.status === 400);
});

test('rentang tanggal: lot selesai dan PO dibuat, awal/akhir hari, terbalik ditolak', () => {
    const f = buildMappingFilters({ fromActualDate: '2026-01-01', toActualDate: '2026-01-31', fromCreatedDate: '2026-02-01', toCreatedDate: '2026-02-28' });
    assert.deepEqual(f.params, ['2026-01-01 00:00:00', '2026-01-31 23:59:59', '2026-02-01 00:00:00', '2026-02-28 23:59:59']);
    assert.match(f.whereSql, /l\.actual_completed_datetime >= \? AND l\.actual_completed_datetime <= \? AND h\.created_at >= \? AND h\.created_at <= \?/);
    assert.throws(() => buildMappingFilters({ fromActualDate: '2026-02-01', toActualDate: '2026-01-01' }), (e) => e.status === 400);
    assert.throws(() => buildMappingFilters({ fromCreatedDate: '2026-02-01', toCreatedDate: '2026-01-01' }), (e) => e.status === 400);
    assert.throws(() => buildMappingFilters({ toActualDate: '2026-02-31' }), (e) => e.status === 400);
});

test('parseMappingRequest: bawaan BY_PO, DESC, halaman 1, limit maksimum 100', () => {
    const r = parseMappingRequest({});
    assert.equal(r.displayMode, 'BY_PO');
    assert.equal(r.order, 'DESC');
    assert.equal(r.page, 1);
    assert.equal(r.limit, 10);
    assert.equal(parseMappingRequest({ limit: '99999' }).limit, 100);
    assert.equal(parseMappingRequest({ sortOrder: 'asc' }).order, 'ASC');
    assert.equal(parseMappingRequest({ sortOrder: 'x; DROP' }).order, 'DESC');
});

test('parseMappingRequest: mode tampilan hanya yang dikenal', () => {
    for (const m of DISPLAY_MODES) assert.equal(parseMappingRequest({ displayMode: m }).displayMode, m);
    assert.throws(() => parseMappingRequest({ displayMode: 'BY_X' }), (e) => e.status === 400);
    assert.throws(() => parseMappingRequest({ displayMode: 'by_po' }), (e) => e.status === 400);
});
