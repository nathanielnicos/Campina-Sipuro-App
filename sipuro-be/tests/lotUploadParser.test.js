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
const { TRANS_TYPE } = require('../services/production-lot/lotAllocationRules');

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
    const out = parseProductionExcel(Buffer.from('x'));
    assert.equal(out.rawRows.length, 3);
    assert.deepEqual(out.rawRows.map((r) => r.qtyIsWhole), [true, false, false]);
    assert.equal(out.rawRows[1].qtyPac, 2.5);
    assert.equal(out.rawRows[2].rawQtyText, 'abc');
    assert.equal(out.rawRows[2].transType, TRANS_TYPE.RETURN);
});
