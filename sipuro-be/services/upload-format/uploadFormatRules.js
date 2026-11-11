'use strict';

/**
 * Aturan bersama format file Excel upload (laporan RORCWMS06), diatur dari halaman Setting oleh superadmin.
 * Satu-satunya tempat yang mendefinisikan field per scope beserta kolom bawaannya, serta validasinya.
 *
 *  scope      : LOT (upload produksi lot) atau DO (upload Delivery Order dan retur); masing-masing punya format sendiri
 *  startRow   : nomor baris Excel (mulai 1) tempat data pertama berada
 *  timestampCell : sel Excel (mis. K1) berisi waktu proses laporan; dipakai mendeteksi file yang sudah pernah diupload
 *  columns    : huruf kolom Excel (A..ZZ) untuk tiap field
 * Nilai bawaan = format laporan RORCWMS06 terbaru (tarikan 10 Nov 2026): Trans Date B, Item C, Doc Source E, Trans Type J,
 * Lot Num K, Status L, Exp Date P, Qty In Q, Qty Out T, Shipment Num. Z; timestamp di I1; data mulai baris 7
 * (baris judul total/grup di antara data tidak punya Trans Type sehingga dilewati). Bila format berubah lagi, ubah di Setting.
 */

const { SCOPE, QTY_COLUMN } = require('../upload-trans-type/uploadTransTypeRules');
const { columnToIndex, indexToColumn, parseCellAddress } = require('../../helpers/excelColumns');

const DEFAULT_START_ROW = 7;
const DEFAULT_TIMESTAMP_CELL = 'I1';
const MAX_START_ROW = 1000;
const MAX_COLUMN_INDEX = columnToIndex('ZZ');
const MAX_TIMESTAMP_ROW = MAX_START_ROW;

const FIELDS = Object.freeze({
    [SCOPE.LOT]: Object.freeze([
        { key: 'TRANS_TYPE', label: 'Trans Type', column: 'J' },
        { key: 'STATUS', label: 'Status', column: 'L' },
        { key: 'TRANS_DATE', label: 'Trans Date', column: 'B' },
        { key: 'ITEM', label: 'Item', column: 'C' },
        { key: 'DOC_SOURCE', label: 'Doc Source', column: 'E' },
        { key: 'LOT_NUMBER', label: 'Lot Num', column: 'K' },
        { key: 'EXP_DATE', label: 'Exp Date', column: 'P' },
        { key: 'QTY_IN', label: 'Qty In (Primary)', column: indexToColumn(QTY_COLUMN.IN) },
        { key: 'QTY_OUT', label: 'Qty Out (Primary)', column: indexToColumn(QTY_COLUMN.OUT) }
    ]),
    [SCOPE.DO]: Object.freeze([
        { key: 'TRANS_TYPE', label: 'Trans Type', column: 'J' },
        { key: 'STATUS', label: 'Status', column: 'L' },
        { key: 'TRANS_DATE', label: 'Trans Date', column: 'B' },
        { key: 'ITEM', label: 'Item', column: 'C' },
        { key: 'LOT_NUMBER', label: 'Lot Num', column: 'K' },
        { key: 'QTY_IN', label: 'Qty In (Primary)', column: indexToColumn(QTY_COLUMN.IN) },
        { key: 'QTY_OUT', label: 'Qty Out (Primary)', column: indexToColumn(QTY_COLUMN.OUT) },
        { key: 'REFERENCE', label: 'Shipment Num. (DO / Return Number)', column: 'Z' }
    ])
});

const fieldsOf = (scope) => FIELDS[scope] || [];

const cleanText = (raw) => String(raw === undefined || raw === null ? '' : raw).trim().toUpperCase();

/** Pengaturan bawaan sebuah scope: { startRow, timestampCell, columns: { KEY: 'B', ... } }. */
const defaultSettings = (scope) => ({
    startRow: DEFAULT_START_ROW,
    timestampCell: DEFAULT_TIMESTAMP_CELL,
    columns: Object.fromEntries(fieldsOf(scope).map((f) => [f.key, f.column]))
});

/** Cek isian pengaturan (sudah dibersihkan); mengembalikan daftar pesan kesalahan (kosong bila sah). */
const validateSettings = (scope, { startRow, timestampCell, columns }) => {
    const errors = [];
    const fields = fieldsOf(scope);
    if (!Object.values(SCOPE).includes(scope)) {
        return ['Invalid scope.'];
    }

    if (!Number.isInteger(startRow) || startRow < 1 || startRow > MAX_START_ROW) {
        errors.push(`First data row must be a whole number from 1 to ${MAX_START_ROW}.`);
    }

    const cell = parseCellAddress(timestampCell);
    if (!cell || cell.col > MAX_COLUMN_INDEX || cell.row + 1 > MAX_TIMESTAMP_ROW) {
        errors.push('Process timestamp cell must be a cell address such as K1.');
    } else if (Number.isInteger(startRow) && cell.row + 1 >= startRow) {
        errors.push('Process timestamp cell must be above the first data row.');
    }

    const given = columns && typeof columns === 'object' ? columns : {};
    const known = new Set(fields.map((f) => f.key));
    Object.keys(given).filter((key) => !known.has(key)).forEach((key) => errors.push(`Unknown field: ${key}.`));

    const used = new Map();
    for (const field of fields) {
        const letters = given[field.key];
        const index = columnToIndex(letters);
        if (index < 0 || index > MAX_COLUMN_INDEX) {
            errors.push(`${field.label}: column must be letters from A to ZZ.`);
            continue;
        }
        if (used.has(letters)) {
            errors.push(`${field.label} and ${used.get(letters)} cannot use the same column (${letters}).`);
        } else {
            used.set(letters, field.label);
        }
    }
    return errors;
};

// Penyimpanan berupa pasangan kunci-nilai per scope (tabel upload_format_settings)
const KEY_START_ROW = 'START_ROW';
const KEY_TIMESTAMP_CELL = 'TIMESTAMP_CELL';
const COLUMN_KEY_PREFIX = 'COL_';

/** Pengaturan -> daftar [{ key, value }] datar (kunci penyimpanan, nilai teks). */
const settingsToEntries = (scope, settings) => [
    { key: KEY_START_ROW, value: String(settings.startRow) },
    { key: KEY_TIMESTAMP_CELL, value: settings.timestampCell },
    ...fieldsOf(scope).map((f) => ({ key: `${COLUMN_KEY_PREFIX}${f.key}`, value: settings.columns[f.key] }))
];

/** Baris tabel ({ setting_key, setting_value }) -> pengaturan; kunci yang tidak ada memakai nilai bawaan. */
const settingsFromRows = (scope, rows = []) => {
    const settings = defaultSettings(scope);
    for (const row of rows) {
        const key = row.setting_key;
        const value = row.setting_value;
        if (key === KEY_START_ROW) settings.startRow = Number(value);
        else if (key === KEY_TIMESTAMP_CELL) settings.timestampCell = cleanText(value);
        else if (key.startsWith(COLUMN_KEY_PREFIX)) {
            const fieldKey = key.slice(COLUMN_KEY_PREFIX.length);
            if (Object.prototype.hasOwnProperty.call(settings.columns, fieldKey)) settings.columns[fieldKey] = cleanText(value);
        }
    }
    return settings;
};

/**
 * Pengaturan -> format siap pakai parser: { startRow, timestampCell, columns: { KEY: indeks 0-based } }.
 * startRow tetap nomor baris Excel (mulai 1).
 */
const buildFormat = (scope, settings) => ({
    startRow: settings.startRow,
    timestampCell: settings.timestampCell,
    columns: Object.fromEntries(Object.entries(settings.columns).map(([key, letters]) => [key, columnToIndex(letters)]))
});

const defaultFormat = (scope) => buildFormat(scope, defaultSettings(scope));

module.exports = {
    SCOPE,
    DEFAULT_START_ROW,
    DEFAULT_TIMESTAMP_CELL,
    MAX_START_ROW,
    FIELDS,
    fieldsOf,
    cleanText,
    defaultSettings,
    validateSettings,
    settingsToEntries,
    settingsFromRows,
    buildFormat,
    defaultFormat
};
