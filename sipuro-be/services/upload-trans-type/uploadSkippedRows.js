'use strict';

/**
 * Pelacak baris Excel yang dilewati karena Trans Type WAJIB sebuah upload tidak dikenali (nonaktif atau tidak terdaftar).
 * Dipakai parser upload Production Lot dan Delivery Order agar preview bisa memberi tahu pengguna.
 * Hanya jenis wajib yang dipantau (parser menyerahkan daftarnya). Jenis lain, termasuk jenis milik upload yang lain
 * (file RORCWMS06 memuat semua jenis dan diupload ke dua halaman), dilewati tanpa peringatan.
 * Ringkasan dikelompokkan per Trans Type dan nomor barisnya dibatasi agar respons tetap kecil.
 */

const { normalizeTransType } = require('./uploadTransTypeRules');

const MAX_SAMPLE_ROWS = 10;

/** @param {string[]} watchedTransTypes nama jenis wajib; tidak peka huruf besar/kecil dan spasi berlebih */
const createSkippedRowTracker = (watchedTransTypes = []) => {
    const watched = new Set(watchedTransTypes.map(normalizeTransType));
    const groups = new Map();
    let total = 0;

    return {
        add(rawTransType, excelRowNumber) {
            const label = String(rawTransType === undefined || rawTransType === null ? '' : rawTransType)
                .trim().replace(/\s+/g, ' ');
            const key = normalizeTransType(label);
            if (!watched.has(key)) return;

            total += 1;
            let group = groups.get(key);
            if (!group) {
                group = { transType: label, rowCount: 0, sampleRows: [] };
                groups.set(key, group);
            }
            group.rowCount += 1;
            if (group.sampleRows.length < MAX_SAMPLE_ROWS) group.sampleRows.push(excelRowNumber);
        },

        summary() {
            return {
                skippedRowCount: total,
                skippedTransTypes: [...groups.values()]
            };
        }
    };
};

module.exports = { createSkippedRowTracker, MAX_SAMPLE_ROWS };
