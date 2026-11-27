'use strict';

/**
 * Memecah array menjadi potongan berukuran `size` (dipakai agar `IN (?)` tidak terlalu besar).
 * Satu-satunya definisi chunk; jangan menulis ulang di modul lain.
 */
const chunk = (arr, size) => {
    if (!Number.isInteger(size) || size <= 0) {
        throw new RangeError('chunk size must be a positive integer');
    }
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

module.exports = { chunk };
