/**
 * Format angka ke mata uang IDR (contoh: Rp 1.000.000)
 */
export const formatCurrency = (val) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

/**
 * Format angka ke tampilan kuantitas berpemisah ribuan (contoh: 1.000)
 */
export const formatQty = (val) =>
    val || val === 0 ? Number(val).toLocaleString('id-ID') : '0';

/**
 * Format input string/angka menjadi string berpemisah ribuan format IDR (contoh: "1.000")
 */
export const formatThousand = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const cleanStr = String(val).replace(/\D/g, '');
    if (!cleanStr) return '';
    return Number(cleanStr).toLocaleString('id-ID');
};

/**
 * Mengubah string berpemisah ribuan kembali ke string angka murni (contoh: "1.000" -> "1000")
 */
export const unformatThousand = (val) => {
    if (!val && val !== 0) return '';
    return String(val).replace(/\./g, '').replace(/,/g, '');
};

/**
 * Format gender (Hanya mendukung 'M' -> 'Male' dan 'F' -> 'Female')
 */
export const formatGender = (gender) => {
    if (!gender) return '-';

    const g = String(gender).toUpperCase();

    if (g === 'M') return 'Male';
    if (g === 'F') return 'Female';

    return gender;
};
