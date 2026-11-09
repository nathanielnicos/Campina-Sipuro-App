'use strict';

/**
 * Pelacak baris Excel yang dilewati karena Trans Type-nya tidak dikenali (belum terdaftar atau nonaktif).
 * Dipakai parser upload Production Lot dan Delivery Order agar preview bisa memberi tahu pengguna.
 * Baris tanpa Trans Type (judul, subtotal, baris kosong) bukan baris data dan tidak dilaporkan.
 * Ringkasan dikelompokkan per Trans Type dan nomor barisnya dibatasi agar respons tetap kecil.
 */

const { normalizeTransType } = require('./uploadTransTypeRules');

const MAX_SAMPLE_ROWS = 10;
const MAX_LABEL_LENGTH = 100;

const createSkippedRowTracker = () => {
    const groups = new Map();
    let total = 0;

    return {
        add(rawTransType, excelRowNumber) {
            const label = String(rawTransType === undefined || rawTransType === null ? '' : rawTransType)
                .trim().replace(/\s+/g, ' ');
            if (!label) return;

            total += 1;
            const key = normalizeTransType(label);
            let group = groups.get(key);
            if (!group) {
                group = { transType: label.slice(0, MAX_LABEL_LENGTH), rowCount: 0, sampleRows: [] };
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
