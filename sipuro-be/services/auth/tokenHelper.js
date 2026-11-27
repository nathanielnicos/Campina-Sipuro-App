const jwt = require('jsonwebtoken');

const TOKEN_EXPIRES_IN = '12h';
const MIN_SECRET_LENGTH = 32;
const DEV_FALLBACK_SECRET = 'sipuro-dev-only-secret-change-me-0123456789';

/**
 * Secret JWT dibaca dari env JWT_SECRET.
 * - Production: wajib diisi (minimal 32 karakter), jika tidak server menolak berjalan.
 * - Lokal/development: memakai nilai cadangan dengan peringatan, agar pengujian tidak terhalang.
 */
const resolveSecret = () => {
    const secret = process.env.JWT_SECRET;

    if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;

    if (process.env.NODE_ENV === 'production') {
        throw new Error(`JWT_SECRET wajib diisi (minimal ${MIN_SECRET_LENGTH} karakter) di environment production.`);
    }

    console.warn('[AUTH] JWT_SECRET belum diisi / kurang dari 32 karakter: memakai secret cadangan khusus development.');
    return DEV_FALLBACK_SECRET;
};

const SECRET = resolveSecret();

/**
 * Membuat token untuk user hasil login.
 * Payload sengaja minimal: peran dan status akun SELALU dibaca ulang dari database oleh middleware.
 * @param {{id: number, type: 'EMPLOYEE'|'CUSTOMER'}} user
 */
const signToken = (user) => jwt.sign(
    { sub: String(user.id), type: user.type },
    SECRET,
    { expiresIn: TOKEN_EXPIRES_IN, algorithm: 'HS256' }
);

/**
 * Memverifikasi token. Melempar error jika tidak valid atau kedaluwarsa.
 * @returns {{sub: string, type: string, exp: number, iat: number}}
 */
const verifyToken = (token) => jwt.verify(token, SECRET, { algorithms: ['HS256'] });

module.exports = { signToken, verifyToken, TOKEN_EXPIRES_IN };
