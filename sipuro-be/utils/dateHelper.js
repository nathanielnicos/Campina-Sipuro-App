/**
 * Helper terpusat untuk penanganan Waktu Indonesia Barat (WIB / UTC+7)
 */

/**
 * Mengembalikan objek Date yang sudah disesuaikan dengan offset WIB (+7 Jam dari UTC)
 */
function getWibDate(date = new Date()) {
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
    const wibOffset = 7 * 60 * 60000; // 7 jam dalam milidetik
    return new Date(utcTime + wibOffset);
}

/**
 * Mengembalikan Tahun berjalan dalam WIB (YYYY)
 */
function getWibYear(date = new Date()) {
    return getWibDate(date).getFullYear();
}

/**
 * Mengembalikan String Waktu Format MySQL (YYYY-MM-DD HH:mm:ss) dalam WIB
 */
function getWibDateTimeString(date = new Date()) {
    const d = getWibDate(date);
    const pad = (n) => String(n).padStart(2, '0');

    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Mengembalikan String Tanggal Murni (YYYY-MM-DD) dalam WIB
 */
function getWibDateString(date = new Date()) {
    const d = getWibDate(date);
    const pad = (n) => String(n).padStart(2, '0');

    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());

    return `${year}-${month}-${day}`;
}

module.exports = {
    getWibDate,
    getWibYear,
    getWibDateTimeString,
    getWibDateString
};
