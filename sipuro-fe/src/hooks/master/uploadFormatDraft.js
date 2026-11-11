// Fungsi murni untuk isian format upload di halaman Setting (tanpa React): server <-> isian layar.
// Aturan validasi sepenuhnya di server; di sini hanya merapikan isian dan membandingkan perubahan.

/** Format dari server -> isian layar (semua teks agar bisa diketik). */
export const toDraft = (format) => ({
    startRow: String(format.startRow),
    timestampCell: format.timestampCell,
    columns: Object.fromEntries(format.columns.map((field) => [field.key, field.column]))
});

/** Isian bawaan sebuah scope (nilai bawaan dari server). */
export const toDefaultDraft = (format) => ({
    startRow: String(format.defaults.startRow),
    timestampCell: format.defaults.timestampCell,
    columns: Object.fromEntries(format.columns.map((field) => [field.key, field.defaultColumn]))
});

/** Huruf kolom / sel: huruf besar tanpa spasi. */
export const cleanLetters = (value) => String(value).replace(/\s+/g, '').toUpperCase();

/** Isian layar -> badan permintaan simpan. */
export const toPayload = (draft) => ({
    startRow: draft.startRow.trim(),
    timestampCell: cleanLetters(draft.timestampCell),
    columns: Object.fromEntries(Object.entries(draft.columns).map(([key, value]) => [key, cleanLetters(value)]))
});

/** Apakah isian berbeda dari yang tersimpan di server. */
export const isDraftChanged = (format, draft) => {
    const saved = toDraft(format);
    const next = toPayload(draft);
    return saved.startRow !== next.startRow
        || saved.timestampCell !== next.timestampCell
        || format.columns.some((field) => saved.columns[field.key] !== next.columns[field.key]);
};
