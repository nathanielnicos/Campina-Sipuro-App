'use strict';

/**
 * Memuat format file upload sebuah scope dari tabel upload_format_settings, siap dipakai parser.
 * Kunci yang belum tersimpan memakai nilai bawaan (format sebelum pengaturan ada).
 */

const { BusinessError } = require('../../helpers/businessError');
const { validateSettings, settingsFromRows, buildFormat } = require('./uploadFormatRules');

const loadUploadSettings = async (queryable, scope) => {
    const [rows] = await queryable.query(
        'SELECT setting_key, setting_value FROM upload_format_settings WHERE scope = ?',
        [scope]
    );
    return settingsFromRows(scope, rows);
};

const loadUploadFormat = async (queryable, scope) => {
    const settings = await loadUploadSettings(queryable, scope);
    // Nilai rusak (mis. diubah langsung di database) tidak boleh membuat file terbaca salah tanpa pesan
    if (validateSettings(scope, settings).length > 0) {
        throw new BusinessError('The upload format setting is invalid. Please correct it in Setting > Upload Format.', 500);
    }
    return buildFormat(scope, settings);
};

module.exports = { loadUploadSettings, loadUploadFormat };
