/**
 * Pengelompokan tampilan baris DO dan retur: nilai yang sama dengan baris sebelumnya dalam kelompok yang sama
 * (mis. tanggal yang sama dalam satu DO) hanya ditampilkan sekali, nilai yang berbeda ditampilkan lagi.
 */

/**
 * @param {Array<{ group: any, value: any }>} entries urutan baris; group = kelompok (nomor DO / nomor retur)
 * @returns {boolean[]} true bila nilai baris itu perlu ditampilkan: baris pertama tiap kelompok,
 *          atau nilainya berbeda dari baris sebelumnya dalam kelompok yang sama
 */
export const markChanges = (entries) => {
    let prev = null;
    return entries.map(({ group, value }) => {
        const show = prev === null || prev.group !== group || prev.value !== value;
        prev = { group, value };
        return show;
    });
};

/**
 * Ringkasan tanggal satu baris Summary: tanggal paling awal, jumlah tanggal lain, dan kunci untuk membandingkan
 * dengan baris sebelumnya.
 * @param {Array<string|null>} dates
 */
export const summarizeDates = (dates) => {
    const distinct = [...new Set((dates || []).filter(Boolean).map(String))].sort();
    return { key: distinct.join('|'), first: distinct[0] || null, extra: Math.max(0, distinct.length - 1), all: distinct };
};
