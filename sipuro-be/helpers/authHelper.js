const bcrypt = require('bcryptjs');

/**
 * Membandingkan input password dengan hash database.
 * Jika password di database masih berupa plain-text, lakukan perbandingan langsung.
 */
exports.comparePassword = async (plainPassword, hashedPassword) => {
    if (!hashedPassword) return false;

    // Jika password di DB belum di-hash dengan bcrypt
    if (!hashedPassword.startsWith('$2a$') && !hashedPassword.startsWith('$2b$')) {
        return plainPassword === hashedPassword;
    }

    return await bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Membuat hash password baru
 */
exports.hashPassword = async (plainPassword) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(plainPassword, salt);
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
