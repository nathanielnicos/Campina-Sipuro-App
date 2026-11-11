'use strict';

/**
 * Utilitas generik kolom dan alamat sel Excel: huruf kolom <-> indeks 0-based (A = 0), alamat sel seperti "K1".
 * Mendukung huruf kolom hingga 3 huruf (A..XFD).
 */

const columnToIndex = (letters) => {
    if (typeof letters !== 'string' || !/^[A-Z]{1,3}$/.test(letters)) return -1;
    let value = 0;
    for (const ch of letters) value = value * 26 + (ch.charCodeAt(0) - 64);
    return value - 1;
};

const indexToColumn = (index) => {
    if (!Number.isInteger(index) || index < 0) return '';
    let n = index + 1;
    let letters = '';
    while (n > 0) {
        const rest = (n - 1) % 26;
        letters = String.fromCharCode(65 + rest) + letters;
        n = Math.floor((n - 1) / 26);
    }
    return letters;
};

/** "K1" -> { col: 10, row: 0 } (keduanya 0-based); alamat tidak sah -> null. */
const parseCellAddress = (address) => {
    const match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(typeof address === 'string' ? address : '');
    if (!match) return null;
    return { col: columnToIndex(match[1]), row: Number(match[2]) - 1 };
};

module.exports = { columnToIndex, indexToColumn, parseCellAddress };
