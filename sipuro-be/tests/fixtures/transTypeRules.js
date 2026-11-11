'use strict';

// Isi awal tabel upload_trans_types (sama dengan migrasi_A_upload_trans_types.sql), dipakai tes parser dan controller
const { rowToRule, buildRuleFinder } = require('../../services/upload-trans-type/uploadTransTypeRules');
const { SCOPE, defaultFormat } = require('../../services/upload-format/uploadFormatRules');

const row = (trans_type, direction, match_by = 'BATCH_LOT') => ({ trans_type, direction, match_by });

const LOT_ROWS = [
    row('WIP Completion', 'IN'),
    row('WIP Completion Return', 'OUT'),
    row('Good Issue Sample QC', 'OUT', 'LOT'),
    row('Good Issue Sample RND', 'OUT', 'LOT'),
    row('WIP Issue', 'OUT', 'LOT')
];
const DO_ROWS = [row('Sales Order Issue', 'OUT'), row('RMA Receipt', 'IN')];

// Baris Excel uji: nilai ditaruh pada kolom sesuai format (kunci field -> nilai), sisanya kosong
const placeCells = (format, values) => {
    const cells = [];
    for (const [key, value] of Object.entries(values)) cells[format.columns[key]] = value;
    return cells;
};

module.exports = {
    placeCells,
    LOT_ROWS,
    DO_ROWS,
    lotRules: LOT_ROWS.map(rowToRule),
    findLotRule: buildRuleFinder(LOT_ROWS.map(rowToRule)),
    findDoRule: buildRuleFinder(DO_ROWS.map(rowToRule)),
    // Format upload bawaan (sama dengan tata letak file sebelum ada pengaturan)
    lotFormat: defaultFormat(SCOPE.LOT),
    doFormat: defaultFormat(SCOPE.DO)
};
