'use strict';

/**
 * Pengelolaan format file Excel upload (kolom tiap field, baris data pertama, sel process timestamp), dipakai halaman Setting.
 * Tidak ada penghapusan. Setiap perubahan dicatat per nilai di upload_format_setting_logs (nilai lama, nilai baru, pelaku).
 * Perubahan berjalan di dalam transaksi ber-lock bersama upload (helpers/lockedTransaction).
 */

const { BusinessError } = require('../../helpers/businessError');
const {
    SCOPE, fieldsOf, cleanText, defaultSettings, validateSettings, settingsToEntries, settingsFromRows
} = require('./uploadFormatRules');

// ---------- Pembacaan input (murni) ----------

const parseScope = (raw) => {
    const scope = cleanText(raw);
    if (!Object.values(SCOPE).includes(scope)) {
        throw new BusinessError('Invalid scope.', 400);
    }
    return scope;
};

const parseStartRow = (raw) => {
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());
    return NaN;
};

/** Isian pembaruan: seluruh pengaturan sebuah scope (startRow, timestampCell, columns). */
const parseUpdateInput = (scopeRaw, body = {}) => {
    const scope = parseScope(scopeRaw);
    const rawColumns = body.columns && typeof body.columns === 'object' && !Array.isArray(body.columns) ? body.columns : {};
    const input = {
        startRow: parseStartRow(body.startRow),
        timestampCell: cleanText(body.timestampCell),
        columns: Object.fromEntries(Object.entries(rawColumns).map(([key, value]) => [key, cleanText(value)]))
    };
    const errors = validateSettings(scope, input);
    if (errors.length > 0) throw new BusinessError(errors[0], 400, { problems: errors });
    return { scope, ...input };
};

// ---------- Pembacaan data ----------

const shapeView = (scope, settings) => ({
    scope,
    startRow: settings.startRow,
    timestampCell: settings.timestampCell,
    columns: fieldsOf(scope).map((field) => ({
        key: field.key,
        label: field.label,
        column: settings.columns[field.key],
        defaultColumn: field.column
    })),
    defaults: { startRow: defaultSettings(scope).startRow, timestampCell: defaultSettings(scope).timestampCell }
});

/** Format kedua scope (nilai tersimpan; yang belum tersimpan memakai nilai bawaan). */
const listFormats = async (queryable) => {
    const [rows] = await queryable.query('SELECT scope, setting_key, setting_value FROM upload_format_settings ORDER BY scope, id');
    return Object.values(SCOPE).map((scope) => shapeView(scope, settingsFromRows(scope, rows.filter((row) => row.scope === scope))));
};

// ---------- Aksi (di dalam transaksi ber-lock) ----------

const updateFormat = async (connection, { scope, startRow, timestampCell, columns, userId }) => {
    const [stored] = await connection.query(
        'SELECT setting_key, setting_value FROM upload_format_settings WHERE scope = ? FOR UPDATE',
        [scope]
    );
    const storedKeys = new Set(stored.map((row) => row.setting_key));
    const current = new Map(settingsToEntries(scope, settingsFromRows(scope, stored)).map((e) => [e.key, e.value]));
    const next = settingsToEntries(scope, { startRow, timestampCell, columns });

    const changed = next.filter((entry) => current.get(entry.key) !== entry.value);
    if (changed.length === 0) {
        throw new BusinessError('No changes to save.', 400);
    }

    const changedKeys = new Set(changed.map((entry) => entry.key));
    // Baris yang belum pernah tersimpan ikut dibuat agar tabel lengkap; baris tidak berubah tidak disentuh (pelaku tetap benar)
    for (const entry of next.filter((e) => changedKeys.has(e.key) || !storedKeys.has(e.key))) {
        await connection.query(
            `INSERT INTO upload_format_settings (scope, setting_key, setting_value, updated_by)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
            [scope, entry.key, entry.value, userId]
        );
    }
    for (const entry of changed) {
        await connection.query(
            `INSERT INTO upload_format_setting_logs (scope, setting_key, old_value, new_value, changed_by)
             VALUES (?, ?, ?, ?, ?)`,
            [scope, entry.key, current.get(entry.key), entry.value, userId]
        );
    }

    return shapeView(scope, { startRow, timestampCell, columns });
};

module.exports = {
    parseScope,
    parseUpdateInput,
    listFormats,
    updateFormat
};
