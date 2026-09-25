/**
 * Helper zona waktu terpusat untuk Frontend (WIB - UTC+7)
 */

const WIB_TIMEZONE = 'Asia/Jakarta';

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
    const dWib = getWibDate(dateInput);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dWib.getDate()} ${months[dWib.getMonth()]} ${dWib.getFullYear()}`;
};
