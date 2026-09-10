export const formatCurrency = (val) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

export const formatQty = (val) =>
    val || val === 0 ? Number(val).toLocaleString('id-ID') : '0';

export const formatDate = (dateStr) => {
    if (!dateStr) return '-';

    // Konversi langsung menggunakan Date objek agar menyesuaikan offset timezone backend
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';

    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${monthName} ${year}`;
};

export const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';

    const day = String(date.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
};

export const formatGender = (gender) => {
    if (!gender) return '-';

    const g = String(gender).toUpperCase();

    // Mendukung 'M' (Male) / 'L' (Laki-laki) dan 'F' (Female) / 'P' (Perempuan)
    if (g === 'M' || g === 'L') return 'Male';
    if (g === 'F' || g === 'P') return 'Female';

    return gender;
};
