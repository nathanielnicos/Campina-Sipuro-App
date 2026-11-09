'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSkippedRowTracker, MAX_SAMPLE_ROWS } = require('../services/upload-trans-type/uploadSkippedRows');

const WATCHED = ['WIP Completion', 'WIP Completion Return'];

test('kosong: tidak ada baris dilewati', () => {
    assert.deepEqual(createSkippedRowTracker(WATCHED).summary(), { skippedRowCount: 0, skippedTransTypes: [] });
});

test('tanpa daftar pantauan: tidak ada yang dilaporkan', () => {
    const t = createSkippedRowTracker();
    t.add('WIP Completion', 7);
    assert.equal(t.summary().skippedRowCount, 0);
});

test('hanya jenis yang dipantau dilaporkan; jenis lain, kosong, undefined, null, angka diabaikan', () => {
    const t = createSkippedRowTracker(WATCHED);
    [undefined, null, '', '   ', 123, 'Sales Order Issue', 'Foo'].forEach((v, i) => t.add(v, i + 1));
    t.add('WIP Completion', 20);
    assert.deepEqual(t.summary(), { skippedRowCount: 1, skippedTransTypes: [{ transType: 'WIP Completion', rowCount: 1, sampleRows: [20] }] });
});

test('dikelompokkan tanpa peka huruf besar/kecil dan spasi; label memakai penulisan pertama', () => {
    const t = createSkippedRowTracker(WATCHED);
    t.add('WIP Completion', 7); t.add(' wip   COMPLETION ', 8); t.add('WIP Completion Return', 9);
    assert.deepEqual(t.summary().skippedTransTypes, [
        { transType: 'WIP Completion', rowCount: 2, sampleRows: [7, 8] },
        { transType: 'WIP Completion Return', rowCount: 1, sampleRows: [9] }
    ]);
});

test('contoh nomor baris dibatasi, jumlah tetap lengkap', () => {
    const t = createSkippedRowTracker(WATCHED);
    for (let i = 1; i <= MAX_SAMPLE_ROWS + 5; i++) t.add('WIP Completion', i);
    const s = t.summary();
    assert.equal(s.skippedRowCount, MAX_SAMPLE_ROWS + 5);
    assert.equal(s.skippedTransTypes[0].rowCount, MAX_SAMPLE_ROWS + 5);
    assert.equal(s.skippedTransTypes[0].sampleRows.length, MAX_SAMPLE_ROWS);
});
