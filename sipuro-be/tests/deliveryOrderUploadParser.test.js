'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const { findDoRule, doFormat, placeCells } = require('./fixtures/transTypeRules');

let sheet = [];
const originalLoad = Module._load;
Module._load = function patched(request) {
    if (request === 'xlsx') {
        return {
            SSF: { parse_date_code: () => null },
            read: () => ({ SheetNames: ['S'], Sheets: { S: { '!ref': 'A1:AA20', [doFormat.timestampCell]: { w: 'Proses : 27 Oct 2026 08:50:26' } } } }),
            utils: { sheet_to_json: () => sheet, decode_range: () => ({ s: { r: 0 } }) }
        };
    }
    return originalLoad.apply(this, arguments);
};
const { parseDeliveryOrderExcel } = require('../services/delivery-order/deliveryOrderUploadParser');
const { TRANS_TYPE } = require('../services/delivery-order/deliveryOrderRules');
const COLUMN = doFormat.columns;

// Baris seperti contoh RORCWMS06: B jenis, C status, D tanggal, E item, L lot, Q qty in, T qty out, Z nomor
const line = ({ type, status = 'GOOD', date = '01-Dec-2025 08:55:17', item = 'FG-RA-00092', lot = 'FR0-270527', qtyIn = 0, qtyOut = 0, ref = '3400000854' }) => {
    const cells = new Array(27).fill('');
    cells[COLUMN.TRANS_TYPE] = type;
    cells[COLUMN.STATUS] = status;
    cells[COLUMN.TRANS_DATE] = date;
    cells[COLUMN.ITEM] = item;
    cells[COLUMN.LOT_NUMBER] = lot;
    cells[COLUMN.QTY_IN] = qtyIn;
    cells[COLUMN.QTY_OUT] = qtyOut;
    cells[COLUMN.REFERENCE] = ref;
    return cells;
};
const makeSheet = (dataRows) => [['h1'], ['h2'], ['h3'], ['h4'], ['h5'], ['SubTot'], ...dataRows];

test('indeks kolom bawaan sesuai tata letak file terbaru (J, L, B, C, K, Q, T, Z)', () => {
    assert.deepEqual(COLUMN, { TRANS_TYPE: 9, STATUS: 11, TRANS_DATE: 1, ITEM: 2, LOT_NUMBER: 10, QTY_IN: 16, QTY_OUT: 19, REFERENCE: 25 });
    assert.equal(doFormat.startRow, 7);
    assert.equal(doFormat.timestampCell, 'I1');
});

test('Sales order issue: qty dari kolom T, nomor DO dari kolom Z, tanggal dan jam dibaca', () => {
    sheet = makeSheet([line({ type: 'Sales order issue', qtyOut: 28900 })]);
    const { processTimestamp, rawRows } = parseDeliveryOrderExcel(Buffer.from('x'), findDoRule, doFormat);
    assert.equal(processTimestamp, 'Proses : 27 Oct 2026 08:50:26');
    assert.equal(rawRows.length, 1);
    assert.deepEqual(
        { t: rawRows[0].transType, q: rawRows[0].qty, r: rawRows[0].referenceNum, d: rawRows[0].transDateTime, i: rawRows[0].itemCode, l: rawRows[0].lotNumber, row: rawRows[0].excelRowNumber },
        { t: TRANS_TYPE.ISSUE, q: 28900, r: '3400000854', d: '2025-12-01 08:55:17', i: 'FG-RA-00092', l: 'FR0-270527', row: 7 }
    );
});

test('RMA Receipt: qty dari kolom Q, nomor retur dari kolom Z', () => {
    sheet = makeSheet([line({ type: 'RMA Receipt', qtyIn: 44, ref: '1300000003', item: 'FG-ST-00046', lot: 'FS1-270423' })]);
    const { rawRows } = parseDeliveryOrderExcel(Buffer.from('x'), findDoRule, doFormat);
    assert.equal(rawRows[0].transType, TRANS_TYPE.RETURN);
    assert.equal(rawRows[0].qty, 44);
    assert.equal(rawRows[0].referenceNum, '1300000003');
});

test('jenis transaksi lain dilewati, huruf besar kecil tidak berpengaruh', () => {
    sheet = makeSheet([
        line({ type: 'WIP Completion', qtyIn: 5 }),
        line({ type: 'SALES ORDER ISSUE', qtyOut: 3 }),
        line({ type: 'rma receipt', qtyIn: 2 })
    ]);
    const { rawRows } = parseDeliveryOrderExcel(Buffer.from('x'), findDoRule, doFormat);
    assert.deepEqual(rawRows.map((r) => r.transType), [TRANS_TYPE.ISSUE, TRANS_TYPE.RETURN]);
});

test('qty negatif dan desimal tidak ditolak di parser (tanda dipertahankan, kalkulator yang menolak)', () => {
    sheet = makeSheet([line({ type: 'Sales order issue', qtyOut: -5 }), line({ type: 'Sales order issue', qtyOut: 2.5 })]);
    const { rawRows } = parseDeliveryOrderExcel(Buffer.from('x'), findDoRule, doFormat);
    assert.equal(rawRows[0].qty, -5);
    assert.equal(rawRows[1].qtyIsWhole, false);
});

test('nomor DO kosong tidak menggagalkan file (jadi alasan di kalkulator)', () => {
    sheet = makeSheet([line({ type: 'Sales order issue', qtyOut: 3, ref: '' })]);
    const { rawRows } = parseDeliveryOrderExcel(Buffer.from('x'), findDoRule, doFormat);
    assert.equal(rawRows[0].referenceNum, '');
});

test('row hash tetap untuk baris yang sama dan berbeda bila qty atau nomor berbeda', () => {
    sheet = makeSheet([
        line({ type: 'Sales order issue', qtyOut: 10 }),
        line({ type: 'Sales order issue', qtyOut: 10 }),
        line({ type: 'Sales order issue', qtyOut: 11 }),
        line({ type: 'Sales order issue', qtyOut: 10, ref: '3400000855' })
    ]);
    const { rawRows } = parseDeliveryOrderExcel(Buffer.from('x'), findDoRule, doFormat);
    assert.equal(rawRows[0].rowHash, rawRows[1].rowHash);
    assert.notEqual(rawRows[0].rowHash, rawRows[2].rowHash);
    assert.notEqual(rawRows[0].rowHash, rawRows[3].rowHash);
});

test('melebihi batas baris ditolak 422', () => {
    const { MAX_UPLOAD_ROWS } = require('../helpers/uploadConfig');
    sheet = makeSheet(Array.from({ length: MAX_UPLOAD_ROWS + 1 }, () => line({ type: 'Sales order issue', qtyOut: 1 })));
    assert.throws(() => parseDeliveryOrderExcel(Buffer.from('x'), findDoRule, doFormat), (e) => e.status === 422);
});

test('jenis wajib DO yang nonaktif dilaporkan; jenis lain (termasuk jenis produksi) diabaikan tanpa peringatan', () => {
    const { buildRuleFinder } = require('../services/upload-trans-type/uploadTransTypeRules');
    const onlyReturn = buildRuleFinder(require('./fixtures/transTypeRules').DO_ROWS.filter((r) => r.trans_type === 'RMA Receipt').map(require('../services/upload-trans-type/uploadTransTypeRules').rowToRule));
    sheet = makeSheet([
        line({ type: 'RMA Receipt', qtyIn: 5 }),
        line({ type: 'Sales Order Issue', qtyOut: 5 }),
        line({ type: 'sales  order issue', qtyOut: 5 }),
        line({ type: 'WIP Completion', qtyIn: 5 }),
        line({ type: 'Foo', qtyIn: 5 }),
        line({ type: '', qtyIn: 5 }),
        []
    ]);
    const out = parseDeliveryOrderExcel(Buffer.from('x'), onlyReturn, doFormat);
    assert.equal(out.rawRows.length, 1);
    assert.equal(out.skippedRowCount, 2);
    assert.deepEqual(out.skippedTransTypes, [{ transType: 'Sales Order Issue', rowCount: 2, sampleRows: [8, 9] }]);
});

test('format kustom: nomor DO di kolom lain, data mulai baris 9, qty mengikuti kolom Qty In/Out format', () => {
    const { buildFormat, defaultSettings } = require('../services/upload-format/uploadFormatRules');
    const d = defaultSettings('DO');
    const format = buildFormat('DO', { startRow: 9, timestampCell: doFormat.timestampCell, columns: { ...d.columns, REFERENCE: 'AB', QTY_OUT: 'U', QTY_IN: 'R' } });
    const base = { STATUS: 'GOOD', TRANS_DATE: '01-Dec-2025 08:55:17', ITEM: 'FG-X', LOT_NUMBER: 'L1' };
    // kolom lama ikut diisi nilai "salah" untuk memastikan hanya kolom menurut format yang dibaca
    const issue = placeCells(format, { ...base, TRANS_TYPE: 'Sales order issue', QTY_OUT: 7, REFERENCE: 'DO-9' });
    issue[doFormat.columns.QTY_OUT] = 999; issue[doFormat.columns.REFERENCE] = 'SALAH';
    const rma = placeCells(format, { ...base, TRANS_TYPE: 'RMA Receipt', QTY_IN: 3, REFERENCE: 'RT-1' });
    rma[doFormat.columns.QTY_IN] = 888;
    sheet = [['h1'], ['h2'], ['h3'], ['h4'], ['h5'], ['h6'], ['h7'], ['h8'], issue, rma];
    const { rawRows } = parseDeliveryOrderExcel(Buffer.from('x'), findDoRule, format);
    assert.deepEqual(rawRows.map((r) => [r.excelRowNumber, r.transType, r.referenceNum, r.qty]), [
        [9, TRANS_TYPE.ISSUE, 'DO-9', 7],
        [10, TRANS_TYPE.RETURN, 'RT-1', 3]
    ]);
});
