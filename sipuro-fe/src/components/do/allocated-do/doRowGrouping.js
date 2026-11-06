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
 * Ringkasan tanggal satu transaksi (DO atau retur): tanggal utama, jumlah tanggal lain, dan rincian tanggal -> label
 * (mis. nomor lot) untuk tooltip.
 * @param {Array<{ date: string|null, label?: string }>} entries tanggal tiap baris pengiriman / retur
 * @param {string|null} [headerDate] tanggal tingkat transaksi (delivery_orders.do_datetime = tanggal paling awal);
 *                                   bila kosong dipakai tanggal paling awal dari entries
 */
export const summarizeDates = (entries, headerDate = null) => {
    const byDate = new Map();
    (entries || []).forEach((entry) => {
        if (!entry || !entry.date) return;
        const key = String(entry.date);
        if (!byDate.has(key)) byDate.set(key, []);
        const labels = byDate.get(key);
        if (entry.label && !labels.includes(entry.label)) labels.push(entry.label);
    });
    if (headerDate && !byDate.has(String(headerDate))) byDate.set(String(headerDate), []);
    const dates = [...byDate.keys()].sort();
    return {
        first: headerDate ? String(headerDate) : (dates[0] || null),
        extra: Math.max(0, dates.length - 1),
        groups: dates.map((date) => ({ date, labels: byDate.get(date) }))
    };
};

// Ringkasan tanggal per nomor retur dari seluruh barisnya (paginasi per nomor retur: halaman memuat semua baris retur itu)
export const returnDates = (rows) => {
    const byReturn = new Map();
    rows.forEach((row) => {
        if (!byReturn.has(row.return_number)) byReturn.set(row.return_number, []);
        byReturn.get(row.return_number).push({ date: row.return_datetime, label: row.lot_number });
    });
    return new Map([...byReturn.entries()].map(([number, entries]) => [number, summarizeDates(entries)]));
};
