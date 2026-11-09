'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

let sheet = [];
const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request === 'xlsx') {
        return {
            read: () => ({ SheetNames: ['S'], Sheets: { S: { '!ref': 'A1:T20', K1: { w: '2026-02-01 10:00:00' } } } }),
            utils: { sheet_to_json: () => sheet, decode_range: () => ({ s: { r: 0 } }) }
        };
    }
    return originalLoad.apply(this, arguments);
};
const { parseQuantity, parseProductionExcel } = require('../services/production-lot/lotUploadParser');
const { findLotRule } = require('./fixtures/transTypeRules');

const TRANS_TYPE = { COMPLETION: 'WIP Completion', RETURN: 'WIP Completion Return' };

test('parseQuantity: bulat, desimal, kosong, bukan angka', () => {
    assert.deepEqual(parseQuantity(5), { value: 5, isWhole: true });
    assert.deepEqual(parseQuantity('5'), { value: 5, isWhole: true });
    assert.deepEqual(parseQuantity(' -3 '), { value: -3, isWhole: true });
    assert.deepEqual(parseQuantity(undefined), { value: 0, isWhole: true });
    assert.deepEqual(parseQuantity(null), { value: 0, isWhole: true });
    assert.deepEqual(parseQuantity('  '), { value: 0, isWhole: true });
    assert.deepEqual(parseQuantity(2.5), { value: 2.5, isWhole: false });
    assert.deepEqual(parseQuantity('2.5'), { value: 2.5, isWhole: false });
    for (const bad of ['abc', '1e3', '1,5', NaN, Infinity]) {
        assert.deepEqual(parseQuantity(bad), { value: 0, isWhole: false }, String(bad));
    }
});

test('TRANS_TYPE dipakai sebagai nilai trans type baris', () => {
    assert.equal(TRANS_TYPE.COMPLETION, 'WIP Completion');
    assert.equal(TRANS_TYPE.RETURN, 'WIP Completion Return');
});

const makeSheet = (dataRows) => {
    const header = Array.from({ length: 6 }, () => []);
    header[0] = []; header[0][10] = '2026-02-01 10:00:00';
    return [...header, ...dataRows];
};
const dataRow = (type, item, qty) => {
    const r = [];
    r[1] = type; r[2] = 'GOOD'; r[3] = '2026-02-01 10:00:00'; r[4] = item; r[6] = 'BATCH B1'; r[11] = 'L1';
    r[type === TRANS_TYPE.RETURN ? 19 : 16] = qty;
    return r;
};

test('parser tidak menolak qty desimal (keputusan ada di kalkulator) dan membawa penanda', () => {
    sheet = makeSheet([dataRow(TRANS_TYPE.COMPLETION, 'P1', 10), dataRow(TRANS_TYPE.COMPLETION, 'ZZ', 2.5), dataRow(TRANS_TYPE.RETURN, 'P1', 'abc')]);
    const out = parseProductionExcel(Buffer.from('x'), findLotRule);
    assert.equal(out.rawRows.length, 3);
    assert.deepEqual(out.rawRows.map((r) => r.qtyIsWhole), [true, false, false]);
    assert.equal(out.rawRows[1].qtyPac, 2.5);
    assert.equal(out.rawRows[2].rawQtyText, 'abc');
    assert.equal(out.rawRows[2].transType, TRANS_TYPE.RETURN);
});

test('jenis wajib produksi yang nonaktif dilaporkan; jenis lain (termasuk jenis DO dan salah ketik) diabaikan tanpa peringatan', () => {
    const withType = (type) => { const r = dataRow(TRANS_TYPE.COMPLETION, 'P1', 5); r[1] = type; return r; };
    // tanpa aturan WIP Completion / WIP Completion Return (nonaktif); nomor baris Excel: 7 = Good Issue (dikenali)
    const { buildRuleFinder } = require('../services/upload-trans-type/uploadTransTypeRules');
    const onlyIssue = buildRuleFinder(require('./fixtures/transTypeRules').lotRules.filter((r) => r.label === 'WIP Issue'));
    sheet = makeSheet([
        withType('WIP Issue'),
        withType('WIP Completion'),
        withType('Sales Order Issue'),
        withType('Foo Bar'),
        withType('  wip   COMPLETION '),
        withType('WIP Completion Return'),
        [],
        (() => { const r = []; r[0] = 'SubTotal'; return r; })()
    ]);
    const out = parseProductionExcel(Buffer.from('x'), onlyIssue);
    assert.equal(out.rawRows.length, 1);
    assert.equal(out.skippedRowCount, 3);
    assert.deepEqual(out.skippedTransTypes, [
        { transType: 'WIP Completion', rowCount: 2, sampleRows: [8, 11] },
        { transType: 'WIP Completion Return', rowCount: 1, sampleRows: [12] }
    ]);
});

test('semua baris dikenali: tidak ada baris dilewati', () => {
    sheet = makeSheet([dataRow(TRANS_TYPE.COMPLETION, 'P1', 10)]);
    const out = parseProductionExcel(Buffer.from('x'), findLotRule);
    assert.equal(out.skippedRowCount, 0);
    assert.deepEqual(out.skippedTransTypes, []);
});
