'use strict';

/**
 * Aturan bersama daftar jenis transaksi (Trans Type) pada file Excel upload.
 * Daftar disimpan di tabel upload_trans_types dan diatur dari halaman Setting; kode tidak memuat daftar jenisnya.
 *
 *  scope     : LOT (upload produksi lot) atau DO (upload Delivery Order dan retur)
 *  direction : IN  = qty dibaca dari kolom Q ("Qty In"), menambah
 *              OUT = qty dibaca dari kolom T ("Qty Out"), mengurangi
 *  matchBy   : BATCH_LOT = dicocokkan per (batch, lot, item); LOT = dicocokkan per (lot, item), kolom Doc Source tidak dipakai
 * Nama jenis tidak peka huruf besar/kecil dan spasi berlebih diabaikan.
 */

const SCOPE = Object.freeze({ LOT: 'LOT', DO: 'DO' });
const DIRECTION = Object.freeze({ IN: 'IN', OUT: 'OUT' });
const MATCH_BY = Object.freeze({ BATCH_LOT: 'BATCH_LOT', LOT: 'LOT' });

// Kolom Excel (0-based) yang dibaca menurut arah
const QTY_COLUMN = Object.freeze({ IN: 16, OUT: 19 });

const MAX_LABEL_LENGTH = 50;

const normalizeTransType = (text) => String(text === undefined || text === null ? '' : text)
    .trim().replace(/\s+/g, ' ').toLowerCase();

/** Cek isian sebuah jenis; mengembalikan daftar pesan kesalahan (kosong bila sah). */
const validateTransTypeInput = ({ scope, transType, direction, matchBy }) => {
    const errors = [];
    const label = String(transType === undefined || transType === null ? '' : transType).trim().replace(/\s+/g, ' ');
    if (!Object.values(SCOPE).includes(scope)) errors.push('Invalid scope.');
    if (!label) errors.push('Trans type is required.');
    if (label.length > MAX_LABEL_LENGTH) errors.push(`Trans type must be at most ${MAX_LABEL_LENGTH} characters.`);
    if (!Object.values(DIRECTION).includes(direction)) errors.push('Direction must be IN or OUT.');
    if (!Object.values(MATCH_BY).includes(matchBy)) errors.push('Invalid match type.');
    if (matchBy === MATCH_BY.LOT && direction !== DIRECTION.OUT) {
        errors.push('A lot-item type can only reduce allocations (direction OUT).');
    }
    return errors;
};

/** Baris tabel upload_trans_types -> aturan yang dipakai parser. */
const rowToRule = (row) => ({
    label: String(row.trans_type),
    direction: row.direction,
    sign: row.direction === DIRECTION.OUT ? -1 : 1,
    qtyColumn: QTY_COLUMN[row.direction],
    matchBy: row.match_by
});

/** Pencari aturan untuk teks "Trans Type" dari Excel; hasilnya undefined bila jenis tidak dikenal (baris dilewati). */
const buildRuleFinder = (rules = []) => {
    const byName = new Map(rules.map((rule) => [normalizeTransType(rule.label), rule]));
    return (rawText) => byName.get(normalizeTransType(rawText));
};

module.exports = {
    SCOPE,
    DIRECTION,
    MATCH_BY,
    QTY_COLUMN,
    MAX_LABEL_LENGTH,
    normalizeTransType,
    validateTransTypeInput,
    rowToRule,
    buildRuleFinder
};
