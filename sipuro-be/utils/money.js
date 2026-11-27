'use strict';

/**
 * Aturan uang & kuantitas SIPURO (rupiah utuh).
 *
 * Algoritma yang sama dipakai di frontend (src/utils/money.js) supaya angka di layar,
 * di PDF, dan di database selalu identik:
 *   - total per baris   = harga satuan x qty, dibulatkan ke rupiah utuh (setengah ke atas)
 *   - subtotal          = jumlah total semua baris
 *   - PPN               = subtotal x persen PPN / 100, dibulatkan ke rupiah utuh (setengah ke atas)
 *   - total keseluruhan = subtotal + PPN
 *
 * Seluruh hitungan memakai bilangan bulat biasa (tanpa BigInt). Perkalian besar dipecah
 * menjadi bagian bulat dan sisa, sehingga hasilnya tetap eksak untuk semua nominal yang
 * boleh disimpan (maksimal 9.999.999.999.999). Nominal di atas batas langsung ditolak.
 */

// Batas qty per baris.
const MAX_ITEM_QTY = 1000000000;

// Batas nominal: kolom DECIMAL(15,2) maksimal 9.999.999.999.999,99.
// Karena nominal dibulatkan ke rupiah utuh, batasnya 9.999.999.999.999.
const MAX_AMOUNT = 9999999999999;

const AMOUNT_TOO_LARGE_MESSAGE = 'Total PO amount is too large. Please reduce the quantity.';

class AmountTooLargeError extends Error {
    constructor(message = AMOUNT_TOO_LARGE_MESSAGE) {
        super(message);
        this.name = 'AmountTooLargeError';
        this.code = 'AMOUNT_TOO_LARGE';
        this.isValidation = true;
        this.statusCode = 400;
    }
}

// Ubah angka apa pun menjadi bilangan bulat non-negatif.
const toSafeInteger = (value) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

// Pembagian bilangan bulat dengan pembulatan ke bawah yang eksak (a harus < 2^53).
const divFloor = (a, b) => {
    let q = Math.floor(a / b);
    const r = a - q * b;
    if (r < 0) q -= 1;
    else if (r >= b) q += 1;
    return q;
};

/**
 * Hitung a x b / c dengan pembulatan setengah ke atas untuk bilangan bulat non-negatif.
 * Eksak selama a x b < 2^53 (jauh di atas semua nominal yang sah); di atas itu hanya perkiraan.
 */
const mulDivRound = (a, b, c) => {
    const product = a * b;
    if (product <= Number.MAX_SAFE_INTEGER) {
        return divFloor(product + Math.floor(c / 2), c);
    }
    return Math.round(product / c);
};

/**
 * Ubah nilai uang (angka atau string desimal dari MySQL, mis. "1234.50") menjadi sen (integer).
 * Nilai tidak valid atau negatif dianggap 0.
 */
function toCents(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
}

/** Ubah sen (integer) menjadi angka rupiah dengan maksimal 2 desimal. */
function fromCents(cents) {
    return Number(cents) / 100;
}

/**
 * Baca qty dari input. Hanya bilangan bulat (angka atau string angka) yang diterima.
 * Mengembalikan integer, atau null jika bukan bilangan bulat yang valid.
 */
function parseQty(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value : null;
    }
    if (typeof value === 'string' && /^\d{1,10}$/.test(value.trim())) {
        return parseInt(value.trim(), 10);
    }
    return null;
}

/**
 * Total satu baris dalam rupiah utuh (setengah ke atas).
 * @param {number} unitCents harga satuan dalam sen (integer)
 * @param {number} qty       jumlah (integer)
 */
function calcLineTotal(unitCents, qty) {
    const cents = toSafeInteger(unitCents);
    const count = toSafeInteger(qty);

    // cents x count / 100 = (bagian rupiah x count) + (sisa sen x count / 100)
    const wholeRupiah = Math.floor(cents / 100);
    const remainderCents = cents - wholeRupiah * 100;
    const total = wholeRupiah * count + divFloor(remainderCents * count + 50, 100);

    if (total > MAX_AMOUNT) throw new AmountTooLargeError();
    return total;
}

/**
 * Hitung subtotal, PPN, dan total keseluruhan dari total per baris.
 * @param {number[]} lineTotals total tiap baris (rupiah utuh)
 * @param {number}   ppnPercent persen PPN, mis. 11
 */
function calcOrderTotals(lineTotals, ppnPercent) {
    let subtotal = 0;
    for (const lineTotal of lineTotals) {
        subtotal += toSafeInteger(lineTotal);
        if (subtotal > MAX_AMOUNT) throw new AmountTooLargeError();
    }

    const percent = Number(ppnPercent);
    const basisPoints = Number.isFinite(percent) && percent > 0 ? Math.round(percent * 100) : 0;

    // subtotal x basisPoints / 10000, dipecah agar tidak melewati batas bilangan bulat aman.
    const subtotalQuotient = Math.floor(subtotal / 10000);
    const subtotalRemainder = subtotal - subtotalQuotient * 10000;
    const ppnAmount = subtotalQuotient * basisPoints + divFloor(subtotalRemainder * basisPoints + 5000, 10000);
    const total = subtotal + ppnAmount;
    if (total > MAX_AMOUNT) throw new AmountTooLargeError();

    return { subtotal, ppnAmount, total };
}

module.exports = {
    MAX_ITEM_QTY,
    MAX_AMOUNT,
    AMOUNT_TOO_LARGE_MESSAGE,
    AmountTooLargeError,
    mulDivRound,
    toCents,
    fromCents,
    parseQty,
    calcLineTotal,
    calcOrderTotals
};
