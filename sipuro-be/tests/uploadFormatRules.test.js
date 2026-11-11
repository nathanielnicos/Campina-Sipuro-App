'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    SCOPE, fieldsOf, defaultSettings, validateSettings, settingsToEntries, settingsFromRows, buildFormat, defaultFormat, MAX_START_ROW
} = require('../services/upload-format/uploadFormatRules');

test('bawaan sama dengan tata letak laporan RORCWMS06 terbaru (Trans Date B, Item C, Doc Source E, Trans Type J, Lot K, Status L, Exp P, Qty Q/T, Shipment Z; baris 7; timestamp I1)', () => {
    assert.deepEqual(defaultSettings(SCOPE.LOT), {
        startRow: 7,
        timestampCell: 'I1',
        columns: { TRANS_TYPE: 'J', STATUS: 'L', TRANS_DATE: 'B', ITEM: 'C', DOC_SOURCE: 'E', LOT_NUMBER: 'K', EXP_DATE: 'P', QTY_IN: 'Q', QTY_OUT: 'T' }
    });
    assert.deepEqual(defaultSettings(SCOPE.DO).columns, { TRANS_TYPE: 'J', STATUS: 'L', TRANS_DATE: 'B', ITEM: 'C', LOT_NUMBER: 'K', QTY_IN: 'Q', QTY_OUT: 'T', REFERENCE: 'Z' });
    assert.deepEqual(defaultFormat(SCOPE.LOT).columns, { TRANS_TYPE: 9, STATUS: 11, TRANS_DATE: 1, ITEM: 2, DOC_SOURCE: 4, LOT_NUMBER: 10, EXP_DATE: 15, QTY_IN: 16, QTY_OUT: 19 });
    assert.deepEqual(defaultFormat(SCOPE.DO).columns, { TRANS_TYPE: 9, STATUS: 11, TRANS_DATE: 1, ITEM: 2, LOT_NUMBER: 10, QTY_IN: 16, QTY_OUT: 19, REFERENCE: 25 });
    assert.equal(defaultFormat(SCOPE.DO).startRow, 7);
});

test('pengaturan bawaan sah untuk kedua scope; scope tidak dikenal tidak punya field', () => {
    for (const scope of Object.values(SCOPE)) assert.deepEqual(validateSettings(scope, defaultSettings(scope)), []);
    assert.deepEqual(fieldsOf('X'), []);
    assert.deepEqual(validateSettings('X', defaultSettings(SCOPE.LOT)), ['Invalid scope.']);
});

test('validasi baris awal: bilangan bulat 1..batas', () => {
    const base = defaultSettings(SCOPE.DO);
    for (const ok of [1, 7, MAX_START_ROW]) assert.deepEqual(validateSettings(SCOPE.DO, { ...base, startRow: ok, timestampCell: 'A1' }).filter((e) => /First data row/.test(e)), [], String(ok));
    for (const bad of [0, -1, 1.5, MAX_START_ROW + 1, NaN, '7', null, undefined]) {
        assert.ok(validateSettings(SCOPE.DO, { ...base, startRow: bad }).some((e) => /First data row/.test(e)), String(bad));
    }
});

test('validasi sel timestamp: alamat sah, kolom sampai ZZ, harus di atas baris data pertama', () => {
    const base = defaultSettings(SCOPE.LOT);
    assert.deepEqual(validateSettings(SCOPE.LOT, { ...base, timestampCell: 'M2' }), []);
    for (const bad of ['', 'k1', 'K0', 'K', '1', 'AAA1', 'K1 ', null]) {
        assert.ok(validateSettings(SCOPE.LOT, { ...base, timestampCell: bad }).some((e) => /cell address/.test(e)), String(bad));
    }
    assert.ok(validateSettings(SCOPE.LOT, { ...base, timestampCell: 'K7' }).some((e) => /above the first data row/.test(e)));
    assert.ok(validateSettings(SCOPE.LOT, { ...base, timestampCell: 'K9' }).some((e) => /above the first data row/.test(e)));
    assert.deepEqual(validateSettings(SCOPE.LOT, { ...base, startRow: 3, timestampCell: 'K2' }), []);
});

test('validasi kolom: wajib semua field, huruf A..ZZ, tidak boleh kembar, tidak boleh field tak dikenal', () => {
    const base = defaultSettings(SCOPE.DO);
    const withCols = (patch) => ({ ...base, columns: { ...base.columns, ...patch } });
    assert.deepEqual(validateSettings(SCOPE.DO, withCols({ REFERENCE: 'AB' })), []);
    assert.ok(validateSettings(SCOPE.DO, withCols({ ITEM: '' })).some((e) => /Item: column must be/.test(e)));
    assert.ok(validateSettings(SCOPE.DO, withCols({ ITEM: 'a' })).some((e) => /Item: column must be/.test(e)));
    assert.ok(validateSettings(SCOPE.DO, withCols({ ITEM: 'AAA' })).some((e) => /Item: column must be/.test(e)));
    assert.ok(validateSettings(SCOPE.DO, withCols({ ITEM: '5' })).some((e) => /Item: column must be/.test(e)));
    assert.ok(validateSettings(SCOPE.DO, withCols({ QTY_OUT: 'Q' })).some((e) => /cannot use the same column \(Q\)/.test(e)));
    assert.ok(validateSettings(SCOPE.DO, withCols({ FOO: 'Z' })).some((e) => /Unknown field: FOO/.test(e)));
    const missing = { ...base, columns: { ...base.columns } };
    delete missing.columns.LOT_NUMBER;
    assert.ok(validateSettings(SCOPE.DO, missing).some((e) => /Lot Num: column must be/.test(e)));
    assert.ok(validateSettings(SCOPE.DO, { ...base, columns: null }).length > 0);
});

test('entri penyimpanan bolak-balik; kunci yang belum tersimpan memakai bawaan; kunci asing diabaikan', () => {
    const settings = { startRow: 9, timestampCell: 'M2', columns: { ...defaultSettings(SCOPE.DO).columns, REFERENCE: 'AB' } };
    const entries = settingsToEntries(SCOPE.DO, settings);
    assert.deepEqual(entries.slice(0, 2), [{ key: 'START_ROW', value: '9' }, { key: 'TIMESTAMP_CELL', value: 'M2' }]);
    assert.equal(entries.length, 2 + fieldsOf(SCOPE.DO).length);
    const rows = entries.map((e) => ({ setting_key: e.key, setting_value: e.value }));
    assert.deepEqual(settingsFromRows(SCOPE.DO, rows), settings);

    assert.deepEqual(settingsFromRows(SCOPE.DO, []), defaultSettings(SCOPE.DO));
    const partial = settingsFromRows(SCOPE.DO, [{ setting_key: 'COL_ITEM', setting_value: 'f' }, { setting_key: 'COL_constructor', setting_value: 'Z' }, { setting_key: 'LAIN', setting_value: 'x' }]);
    assert.equal(partial.columns.ITEM, 'F');
    assert.deepEqual({ ...partial, columns: { ...partial.columns, ITEM: defaultSettings(SCOPE.DO).columns.ITEM } }, defaultSettings(SCOPE.DO));
});

test('buildFormat: huruf kolom menjadi indeks, baris awal tetap nomor baris Excel', () => {
    const f = buildFormat(SCOPE.LOT, { startRow: 9, timestampCell: 'M2', columns: { ...defaultSettings(SCOPE.LOT).columns, LOT_NUMBER: 'AA' } });
    assert.equal(f.columns.LOT_NUMBER, 26);
    assert.equal(f.startRow, 9);
    assert.equal(f.timestampCell, 'M2');
});
