/**
 * Helper zona waktu terpusat untuk Frontend (WIB - UTC+7)
 */

const WIB_TIMEZONE = 'Asia/Jakarta';

/**
 * Array nama bulan singkat dalam bahasa Inggris (Terpusat)
 */
export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Mengembalikan objek Date yang sudah diselaraskan ke Waktu Indonesia Barat (WIB)
 */
export const getWibDate = (dateInput = new Date()) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return new Date();

    const wibString = d.toLocaleString('en-US', { timeZone: WIB_TIMEZONE });
    return new Date(wibString);
};

/**
 * Mengembalikan string tanggal format YYYY-MM-DD berbasis zona waktu WIB
 */
export const getWibDateString = (dateInput = new Date()) => {
    const dWib = getWibDate(dateInput);
    const year = dWib.getFullYear();
    const month = String(dWib.getMonth() + 1).padStart(2, '0');
    const day = String(dWib.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Mengembalikan label tanggal terformat (contoh: "25 Sep 2026") berbasis zona waktu WIB
 */
export const getWibFormattedLabel = (dateInput = new Date()) => {
    return formatDate(dateInput);
};

/**
 * Format tanggal diselaraskan dengan zona waktu WIB (contoh: "25 Sep 2026")
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return '-';

    const date = getWibDate(dateStr);
    if (isNaN(date.getTime())) return '-';

    const day = String(date.getDate()).padStart(2, '0');
    const monthName = MONTHS_EN[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${monthName} ${year}`;
};

/**
 * Format tanggal & waktu diselaraskan dengan zona waktu WIB (contoh: "25 Sep 2026 14:30:00")
 */
export const formatDateTime = (dateString) => {
    if (!dateString) return '-';

    const date = getWibDate(dateString);
    if (isNaN(date.getTime())) return '-';

    const day = String(date.getDate()).padStart(2, '0');
    const month = MONTHS_EN[date.getMonth()];
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
};

/**
 * Mengembalikan timestamp format YYYYMMDD_HHmmss berbasis WIB untuk nama file
 */
export const getWibTimestamp = (dateInput = new Date()) => {
    const now = getWibDate(dateInput);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};
