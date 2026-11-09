'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSkippedRowTracker, MAX_SAMPLE_ROWS } = require('../services/upload-trans-type/uploadSkippedRows');

test('kosong: tidak ada baris dilewati', () => {
    assert.deepEqual(createSkippedRowTracker().summary(), { skippedRowCount: 0, skippedTransTypes: [] });
});

test('teks kosong, spasi, undefined, null diabaikan; angka dan tanggal dicatat sebagai teks', () => {
    const t = createSkippedRowTracker();
    [undefined, null, '', '   '].forEach((v, i) => t.add(v, i + 1));
    t.add(123, 9);
    assert.deepEqual(t.summary(), { skippedRowCount: 1, skippedTransTypes: [{ transType: '123', rowCount: 1, sampleRows: [9] }] });
});

test('dikelompokkan tanpa peka huruf besar/kecil dan spasi; label memakai penulisan pertama', () => {
    const t = createSkippedRowTracker();
    t.add('Good Issue', 7); t.add(' good   ISSUE ', 8); t.add('Other', 9);
    assert.deepEqual(t.summary().skippedTransTypes, [
        { transType: 'Good Issue', rowCount: 2, sampleRows: [7, 8] },
        { transType: 'Other', rowCount: 1, sampleRows: [9] }
    ]);
});

test('contoh nomor baris dibatasi, jumlah tetap lengkap', () => {
    const t = createSkippedRowTracker();
    for (let i = 1; i <= MAX_SAMPLE_ROWS + 5; i++) t.add('X', i);
    const s = t.summary();
    assert.equal(s.skippedRowCount, MAX_SAMPLE_ROWS + 5);
    assert.equal(s.skippedTransTypes[0].rowCount, MAX_SAMPLE_ROWS + 5);
    assert.equal(s.skippedTransTypes[0].sampleRows.length, MAX_SAMPLE_ROWS);
});

test('label sangat panjang dipotong', () => {
    const t = createSkippedRowTracker();
    t.add('A'.repeat(500), 1);
    assert.equal(t.summary().skippedTransTypes[0].transType.length, 100);
});
