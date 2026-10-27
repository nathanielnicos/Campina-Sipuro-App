'use strict';

/**
 * Pembaca parameter query (req.query) yang dipakai bersama oleh modul daftar/ekspor.
 * Satu-satunya definisi; jangan menulis ulang di modul lain.
 */

const { BusinessError } = require('./businessError');

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// Halaman dan batas per halaman; limit tidak boleh melebihi maxLimit.
const parsePageParams = (query = {}, { defaultLimit = 10, maxLimit = 100 } = {}) => {
    const page = parsePositiveInt(query.page, 1);
    const limit = Math.min(maxLimit, parsePositiveInt(query.limit, defaultLimit));
    return { page, limit, offset: (page - 1) * limit };
};

// Tanggal YYYY-MM-DD yang benar-benar ada di kalender; kosong -> null; salah -> BusinessError 400.
const parseDateParam = (value, label) => {
    const text = asText(value);
    if (!text) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (match) {
        const [, year, month, day] = match.map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
            return text;
        }
    }
    throw new BusinessError(`${label} must be a valid date (YYYY-MM-DD).`, 400);
};

// Karakter khusus LIKE (% _ \) dianggap teks biasa.
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

module.exports = { asText, parsePositiveInt, parsePageParams, parseDateParam, escapeLike };
