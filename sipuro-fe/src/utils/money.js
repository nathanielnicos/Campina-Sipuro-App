/**
 * Aturan uang SIPURO (rupiah utuh). Harus sama dengan backend (helpers/money.js)
 * supaya angka di layar, di PDF, dan di database selalu identik:
 *   - total per baris   = harga satuan x qty, dibulatkan ke rupiah utuh (setengah ke atas)
 *   - subtotal          = jumlah total semua baris
 *   - PPN               = subtotal x persen PPN / 100, dibulatkan ke rupiah utuh (setengah ke atas)
 *   - total keseluruhan = subtotal + PPN
 *
 * Seluruh hitungan memakai bilangan bulat biasa (tanpa BigInt) agar jalan di browser lama.
 * Perkalian besar dipecah menjadi bagian bulat dan sisa, sehingga hasilnya tetap eksak
 * untuk semua nominal yang boleh disimpan (maksimal 9.999.999.999.999). Nominal di atas
 * batas hanya perlu terdeteksi sebagai "terlalu besar", bukan dihitung presisi.
 */

// Batas nominal: kolom DECIMAL(15,2) di database maksimal 9.999.999.999.999,99.
export const MAX_AMOUNT = 9999999999999;

export const AMOUNT_TOO_LARGE_MESSAGE = 'Total PO amount is too large. Please reduce the quantity.';

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

/** Ubah nilai uang (angka atau string desimal, mis. "1234.50") menjadi sen (integer). */
export const toCents = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
};

/** Ubah sen (integer) menjadi angka rupiah dengan maksimal 2 desimal. */
export const fromCents = (cents) => Number(cents) / 100;

/**
 * Total satu baris dalam rupiah utuh (setengah ke atas).
 * Nilai di atas batas dihitung kira-kira saja (cukup untuk tampilan); pelanggaran batas
 * dideteksi oleh calcOrderTotals().
 */
export const calcLineTotal = (unitCents, qty) => {
    const cents = toSafeInteger(unitCents);
    const count = toSafeInteger(qty);

    // cents x count / 100 = (bagian rupiah x count) + (sisa sen x count / 100)
    const wholeRupiah = Math.floor(cents / 100);
    const remainderCents = cents - wholeRupiah * 100;
    return wholeRupiah * count + divFloor(remainderCents * count + 50, 100);
};

/**
 * Hitung subtotal, PPN, dan total keseluruhan dari total per baris.
 * `tooLarge` bernilai true jika total melebihi batas yang bisa disimpan.
 */
export const calcOrderTotals = (lineTotals, ppnPercent) => {
    const subtotal = (lineTotals || []).reduce((sum, lineTotal) => sum + toSafeInteger(lineTotal), 0);

    const percent = Number(ppnPercent);
    const basisPoints = Number.isFinite(percent) && percent > 0 ? Math.round(percent * 100) : 0;

    if (subtotal > MAX_AMOUNT) {
        // Sudah pasti terlalu besar; ketepatan angka tidak penting.
        const approxPpn = Math.round((subtotal * basisPoints) / 10000);
        return { subtotal, ppnAmount: approxPpn, total: subtotal + approxPpn, tooLarge: true };
    }

    // subtotal x basisPoints / 10000, dipecah agar tidak melewati batas bilangan bulat aman.
    const subtotalQuotient = Math.floor(subtotal / 10000);
    const subtotalRemainder = subtotal - subtotalQuotient * 10000;
    const ppnAmount = subtotalQuotient * basisPoints + divFloor(subtotalRemainder * basisPoints + 5000, 10000);
    const total = subtotal + ppnAmount;

    return { subtotal, ppnAmount, total, tooLarge: total > MAX_AMOUNT };
};

/**
 * Harga satuan (dalam sen) yang tersimpan pada satu baris PO dari server:
 * harga dasar per satuan dasar dikonversi ke satuan yang dipakai baris tersebut.
 * Jika harga dasar tidak ada, dipakai total dibagi qty.
 */
export const deriveUnitCents = (item) => {
    const qty = Number(item?.qty);
    const baseQty = Number(item?.base_qty);
    const baseCents = toCents(item?.base_price);

    if (Number.isInteger(qty) && qty > 0 && Number.isInteger(baseQty) && baseQty > 0 && baseCents > 0) {
        return mulDivRound(baseCents, baseQty, qty);
    }

    const total = Number(item?.total_price);
    if (qty > 0 && total > 0) {
        return Math.round((total * 100) / qty);
    }
    return 0;
};

/** Harga satuan (rupiah) yang tersimpan pada satu baris PO dari server. */
export const getUnitPrice = (item) => fromCents(deriveUnitCents(item));
