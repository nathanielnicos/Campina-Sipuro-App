'use strict';

const { rateLimit } = require('express-rate-limit');

/**
 * Pembatas jumlah permintaan (rate limiting).
 * Catatan: hitungan disimpan di memori server. Di Vercel (serverless) setiap instance punya hitungan sendiri,
 * jadi ini perlindungan dasar, bukan batas yang mutlak.
 */

const readPositiveInt = (envName, fallback) => {
    const value = Number.parseInt(process.env[envName], 10);
    return Number.isInteger(value) && value > 0 ? value : fallback;
};

const TOO_MANY = { success: false, message: 'Too many requests. Please try again later.' };

const baseOptions = {
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: TOO_MANY
};

// Umum: seluruh /api per alamat IP. Longgar, karena satu kantor bisa memakai satu IP bersama.
const apiLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 1000,
    limit: readPositiveInt('RATE_LIMIT_MAX', 600)
});

// Login: hanya percobaan GAGAL yang dihitung (login berhasil tidak mengurangi jatah).
const makeFailedAttemptLimiter = () => rateLimit({
    ...baseOptions,
    windowMs: 15 * 60 * 1000,
    limit: readPositiveInt('LOGIN_RATE_LIMIT_MAX', 10),
    skipSuccessfulRequests: true
});

const loginLimiter = makeFailedAttemptLimiter();
const passwordChangeLimiter = makeFailedAttemptLimiter();

// Pendaftaran akun: semua permintaan dihitung.
const registerLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 60 * 1000,
    limit: readPositiveInt('REGISTER_RATE_LIMIT_MAX', 20)
});

module.exports = { apiLimiter, loginLimiter, passwordChangeLimiter, registerLimiter };
