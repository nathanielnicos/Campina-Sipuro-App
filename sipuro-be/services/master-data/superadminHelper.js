const xlsx = require('xlsx');

function findHeaderRowIndex(sheetData, requiredColumns) {
    for (let r = 0; r < sheetData.length; r++) {
        const rowUpper = sheetData[r].map(c => String(c || '').toUpperCase().trim());
        const matched = requiredColumns.every(col => rowUpper.includes(col.toUpperCase().trim()));
        if (matched) return r;
    }
    return -1;
}

function parseToFixed(val, precision = 6) {
    if (val === null || val === undefined || val === '' || isNaN(Number(val))) return null;
    return Number(Number(val).toFixed(precision));
}

// Helper aman konversi format tanggal ke format YYYY-MM-DD / null
function safeFormatDate(rawDate) {
    if (
        rawDate === null ||
        rawDate === undefined ||
        String(rawDate).trim() === '' ||
        String(rawDate) === 'None' ||
        String(rawDate).trim() === '-'
    ) {
        return null;
    }

    try {
        // 1. Jika input sudah berupa string format YYYY-MM-DD / YYYY-MM-DDTHH:mm:ss...
        const strDate = String(rawDate).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(strDate)) {
            return strDate.substring(0, 10);
        }

        // 2. Jika angka serial Excel
        if (typeof rawDate === 'number' || (!isNaN(Number(rawDate)) && !strDate.includes('-') && !strDate.includes('/'))) {
            const parsedDate = xlsx.SSF.parse_date_code(Number(rawDate));
            if (parsedDate) {
                const y = parsedDate.y;
                const m = String(parsedDate.m).padStart(2, '0');
                const d = String(parsedDate.d).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }

        // 3. Jika Date object atau string format tanggal lainnya
        const parsed = new Date(rawDate);
        if (isNaN(parsed.getTime())) return null;

        // Gunakan fungsi UTC agar tidak tergeser oleh zona waktu lokal server
        const y = parsed.getUTCFullYear();
        const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const d = String(parsed.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    } catch {
        return null;
    }
}

module.exports = {
    findHeaderRowIndex,
    parseToFixed,
    safeFormatDate
};
