'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { columnToIndex, indexToColumn, parseCellAddress } = require('../helpers/excelColumns');

test('columnToIndex: A=0, Z=25, AA=26, ZZ=701, XFD=16383; tidak sah -> -1', () => {
    assert.equal(columnToIndex('A'), 0);
    assert.equal(columnToIndex('Z'), 25);
    assert.equal(columnToIndex('AA'), 26);
    assert.equal(columnToIndex('ZZ'), 701);
    assert.equal(columnToIndex('XFD'), 16383);
    for (const bad of ['', 'a', 'A1', 'ABCD', '1', ' A', null, undefined, 5]) assert.equal(columnToIndex(bad), -1, String(bad));
});

test('indexToColumn kebalikan columnToIndex; tidak sah -> teks kosong', () => {
    for (const letters of ['A', 'B', 'Q', 'T', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA', 'XFD']) {
        assert.equal(indexToColumn(columnToIndex(letters)), letters);
    }
    for (const bad of [-1, 1.5, NaN, null, undefined, '1']) assert.equal(indexToColumn(bad), '');
});

test('parseCellAddress: K1 -> kolom 10 baris 0; AA12 -> kolom 26 baris 11; tidak sah -> null', () => {
    assert.deepEqual(parseCellAddress('K1'), { col: 10, row: 0 });
    assert.deepEqual(parseCellAddress('AA12'), { col: 26, row: 11 });
    for (const bad of ['', 'k1', 'K0', 'K', '1', 'K-1', 'K1 ', null, undefined, 5]) assert.equal(parseCellAddress(bad), null, String(bad));
});
