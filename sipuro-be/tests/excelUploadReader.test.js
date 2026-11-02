'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

let sheet = [];
let sheetMeta = { '!ref': 'A1:AA20', K1: { w: 'Proses : 27 Oct 2026 08:50:26' } };
let readFails = false;
const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request === 'xlsx') {
        return {
            SSF: { parse_date_code: (n) => (n === 45000.5 ? { y: 2023, m: 3, d: 15, H: 12, M: 0, S: 0 } : null) },
            read: () => {
                if (readFails) throw new Error('bad file');
                return { SheetNames: ['S'], Sheets: { S: sheetMeta } };
            },
            utils: { sheet_to_json: () => sheet, decode_range: () => ({ s: { r: 0 } }) }
        };
    }
    return originalLoad.apply(this, arguments);
};
const { parseExcelDateTime, parseDateOnly, parseQuantity, readUploadSheet } = require('../helpers/excelUploadReader');

test('parseExcelDateTime: teks DD-Mon-YYYY dengan dan tanpa jam, serial number, kosong, salah', () => {
    assert.equal(parseExcelDateTime('01-Dec-2025 08:55:17'), '2025-12-01 08:55:17');
    assert.equal(parseExcelDateTime('1-dec-2025'), '2025-12-01 00:00:00');
    assert.equal(parseExcelDateTime('28-Oct-2025 14:11'), '2025-10-28 14:11:00');
    assert.equal(parseExcelDateTime(45000.5), '2023-03-15 12:00:00');
    assert.equal(parseExcelDateTime(''), null);
    assert.equal(parseExcelDateTime(null), null);
    assert.equal(parseExcelDateTime('bukan tanggal'), null);
});

test('parseDateOnly memotong jam', () => {
    assert.equal(parseDateOnly('01-Dec-2025 08:55:17'), '2025-12-01');
    assert.equal(parseDateOnly(''), null);
});

test('parseQuantity: bulat, desimal, kosong, bukan angka, tanda dipertahankan', () => {
    assert.deepEqual(parseQuantity(28900), { value: 28900, isWhole: true });
    assert.deepEqual(parseQuantity(' -3 '), { value: -3, isWhole: true });
    assert.deepEqual(parseQuantity(undefined), { value: 0, isWhole: true });
    assert.deepEqual(parseQuantity(''), { value: 0, isWhole: true });
    assert.deepEqual(parseQuantity(2.5), { value: 2.5, isWhole: false });
    assert.deepEqual(parseQuantity('2.5'), { value: 2.5, isWhole: false });
    for (const bad of ['abc', '1e3', '1,5', NaN, Infinity]) {
        assert.deepEqual(parseQuantity(bad), { value: 0, isWhole: false }, String(bad));
    }
});

test('readUploadSheet: K1, hash, dan baris data mulai baris ke-7 dengan nomor baris Excel', () => {
    sheet = [['h1'], ['h2'], ['h3'], ['h4'], ['h5'], ['h6'], ['data7'], null, ['data9']];
    sheetMeta = { '!ref': 'A1:AA20', K1: { w: 'Proses : 27 Oct 2026 08:50:26' } };
    const out = readUploadSheet(Buffer.from('abc'));
    assert.equal(out.processTimestamp, 'Proses : 27 Oct 2026 08:50:26');
    assert.equal(out.fileHash.length, 64);
    assert.deepEqual(out.rows.map((r) => r.excelRowNumber), [7, 9]);
    assert.deepEqual(out.rows[0].cells, ['data7']);
});

test('readUploadSheet: K1 kosong ditolak 422, file rusak ditolak 400', () => {
    sheet = [[]];
    sheetMeta = { '!ref': 'A1:AA20' };
    assert.throws(() => readUploadSheet(Buffer.from('x')), (e) => e.status === 422);
    readFails = true;
    assert.throws(() => readUploadSheet(Buffer.from('x')), (e) => e.status === 400);
    readFails = false;
});
