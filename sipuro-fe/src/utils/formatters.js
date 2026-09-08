export const formatCurrency = (val) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

export const formatQty = (val) =>
    val || val === 0 ? Number(val).toLocaleString('id-ID') : '0';

export const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    // Ambil tanggal, bulan, tahun
    const day = String(date.getDate()).padStart(2, '0');

    // Nama bulan singkat (Jan, Feb, Mar, dll)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];

    // Ambil 2 digit terakhir tahun
    const year = String(date.getFullYear()).slice(-2);

    return `${day} ${month} ${year}`;
};

export const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    // Ambil tanggal, bulan, tahun
    const day = String(date.getDate()).padStart(2, '0');

    // Nama bulan singkat (Jan, Feb, Mar, dll)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];

    // Ambil 2 digit terakhir tahun
    const year = String(date.getFullYear()).slice(-2);

    // Ambil jam, menit, detik
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
};
