'use strict';

/**
 * Mengubah string tanggal dari SQL ("YYYY-MM-DD" atau "YYYY-MM-DD HH:mm:ss") menjadi sel tanggal Excel.
 * Murni dari teks (tanpa Date lokal), sehingga tidak bergeser oleh zona waktu server.
 * Kosong atau tidak dikenal -> null (sel kosong, aman untuk pivot dan filter tanggal).
 */

const DATE_TIME_FORMAT = 'yyyy-mm-dd hh:mm:ss';
const DATE_FORMAT = 'yyyy-mm-dd';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toExcelDate = (value, { dateOnly = false } = {}) => {
    if (value === null || value === undefined || value === '') return null;

    const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}):(\d{2}))?/);
    if (!match) return null;

    const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
    const utc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
    const excelEpoch = Date.UTC(1899, 11, 30);

    return { v: (utc - excelEpoch) / MS_PER_DAY, t: 'n', z: dateOnly ? DATE_FORMAT : DATE_TIME_FORMAT };
};

module.exports = { toExcelDate, DATE_TIME_FORMAT, DATE_FORMAT };
