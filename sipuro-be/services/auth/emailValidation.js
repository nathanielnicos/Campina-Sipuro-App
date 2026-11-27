'use strict';

/**
 * Validasi format email tanpa regex berulang (bebas ReDoS): panjang dicek lebih dulu,
 * lalu tiap bagian diperiksa dengan operasi string yang waktunya linear.
 *
 * Aturannya sama dengan pola lama /^[^\s@]+@[^\s@]+\.[^\s@]+$/:
 *  - tanpa spasi apa pun, tepat satu "@",
 *  - bagian sebelum "@" tidak kosong,
 *  - domain berisi minimal satu titik yang tidak berada di awal atau akhir domain.
 */
const isValidEmail = (value, maxLength) => {
    if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) return false;
    if (/\s/.test(value)) return false;

    const at = value.indexOf('@');
    if (at < 1 || at !== value.lastIndexOf('@')) return false;

    const domain = value.slice(at + 1);
    return domain.length >= 3 && domain.slice(1, -1).includes('.');
};

module.exports = { isValidEmail };
