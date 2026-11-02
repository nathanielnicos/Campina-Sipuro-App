// Gaya sel bersama semua tampilan DO: semua sel sejajar di tengah, tanpa sel gabungan,
// sehingga baris selalu lurus. Nilai yang berulang dikosongkan pada baris lanjutan.
export const cellStyle = {
    padding: '10px 14px',
    verticalAlign: 'middle',
    lineHeight: '1.4'
};

export const rowStyle = { borderBottom: '1px solid #dee2e6' };

export const emptyRow = (colSpan, message) => (
    <tr>
        <td colSpan={colSpan} style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>{message}</td>
    </tr>
);
