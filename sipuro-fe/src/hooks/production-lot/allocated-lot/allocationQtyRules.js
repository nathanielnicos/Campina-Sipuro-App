// Aturan form ubah qty alokasi (sama dengan validasi server): qty bilangan bulat >= 0, alasan wajib maksimal 50 karakter.

export const REASON_MAX_LENGTH = 50;
export const MAX_ALLOCATION_QTY = 2147483647; // batas kolom INT di database

// Teks input (angka murni atau berpemisah ribuan titik, mis. "1.000") -> angka; null bila kosong atau bukan bilangan bulat sah.
export const parseQtyInput = (text) => {
    const raw = String(text === null || text === undefined ? '' : text).trim();
    if (!/^\d+(\.\d{3})*$/.test(raw)) return null;
    const value = Number(raw.replace(/\./g, ''));
    return value <= MAX_ALLOCATION_QTY ? value : null;
};

/**
 * Status form: { newQty, reason, isUnchanged, canSubmit }.
 * Tombol simpan aktif hanya bila qty sah, berbeda dari qty sekarang, dan alasan terisi.
 */
export const evaluateQtyForm = ({ qtyText, reasonText, currentQty }) => {
    const newQty = parseQtyInput(qtyText);
    const reason = String(reasonText || '').trim();
    const isUnchanged = newQty !== null && newQty === Number(currentQty);
    return {
        newQty,
        reason,
        isUnchanged,
        canSubmit: newQty !== null && !isUnchanged && reason.length > 0 && reason.length <= REASON_MAX_LENGTH
    };
};
