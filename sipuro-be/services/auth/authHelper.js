const bcrypt = require('bcryptjs');

// Prefix hash bcrypt yang dikenali ($2a$, $2b$, $2y$)
const BCRYPT_PATTERN = /^\$2[aby]\$/;

/**
 * Apakah nilai password di database sudah berupa hash bcrypt.
 */
exports.isHashed = (storedPassword) => BCRYPT_PATTERN.test(storedPassword || '');

/**
 * Membandingkan input password dengan hash database.
 * Jika password di database masih berupa plain-text (data lama), lakukan perbandingan langsung;
 * password tersebut otomatis di-hash oleh controller login setelah login berhasil.
 */
exports.comparePassword = async (plainPassword, hashedPassword) => {
    if (!hashedPassword) return false;

    if (!BCRYPT_PATTERN.test(hashedPassword)) {
        return plainPassword === hashedPassword;
    }

    return await bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Perbandingan "palsu" agar waktu respons untuk username yang tidak ada
 * sama dengan username yang ada (mencegah enumerasi akun lewat waktu respons).
 */
let dummyHash = null;
exports.dummyCompare = async (plainPassword) => {
    if (!dummyHash) {
        dummyHash = await bcrypt.hash('sipuro-dummy-password-for-timing', 10);
    }
    await bcrypt.compare(String(plainPassword), dummyHash);
};

/**
 * Membuat hash password baru
 */
exports.hashPassword = async (plainPassword) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(plainPassword, salt);
};

/**
 * Aturan password baru: 8 - 72 karakter (batas 72 byte bcrypt).
 * @returns {string|null} pesan error, atau null jika valid
 */
exports.validateNewPassword = (password) => {
    if (typeof password !== 'string') return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters long.';
    if (password.length > 72) return 'Password must not exceed 72 characters.';
    return null;
};

/**
 * Mengambil IP Client dari request Express
 */
exports.getClientIp = (req) => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }
    return req.socket.remoteAddress || req.ip || '127.0.0.1';
};
