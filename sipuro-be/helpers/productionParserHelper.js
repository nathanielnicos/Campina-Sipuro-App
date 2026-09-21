const xlsx = require('xlsx');
const crypto = require('crypto');

/**
 * Helper untuk memformat tanggal & jam dari Excel secara aman ke format SQL DATETIME (YYYY-MM-DD HH:mm:ss)
 */
const parseExcelDateTime = (excelDateVal, excelTimeVal) => {
    if (!excelDateVal) return null;

    let dateStr = null;

    // Handle Date
    if (typeof excelDateVal === 'number') {
        const dateObj = xlsx.SSF.parse_date_code(excelDateVal);
        if (dateObj) {
            const y = dateObj.y;
            const m = String(dateObj.m).padStart(2, '0');
            const d = String(dateObj.d).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
        }
    } else {
        const parsedDate = new Date(excelDateVal);
        if (!isNaN(parsedDate.getTime())) {
            dateStr = parsedDate.toISOString().split('T')[0];
        }
    }

    if (!dateStr) return null;

    // Handle Time
    let timeStr = '00:00:00';
    if (excelTimeVal !== undefined && excelTimeVal !== null) {
        if (typeof excelTimeVal === 'number') {
            const timeObj = xlsx.SSF.parse_date_code(excelTimeVal);
            if (timeObj) {
                const hh = String(timeObj.H).padStart(2, '0');
                const mm = String(timeObj.M).padStart(2, '0');
                const ss = String(timeObj.S).padStart(2, '0');
                timeStr = `${hh}:${mm}:${ss}`;
            }
        } else if (typeof excelTimeVal === 'string' && excelTimeVal.trim() !== '') {
            const parts = excelTimeVal.trim().split(':');
            if (parts.length >= 2) {
                const hh = String(parts[0]).padStart(2, '0');
                const mm = String(parts[1]).padStart(2, '0');
                const ss = parts[2] ? String(parts[2]).padStart(2, '0') : '00';
                timeStr = `${hh}:${mm}:${ss}`;
            }
        }
    }

    return `${dateStr} ${timeStr}`;
};

/**
 * Membaca buffer file Excel dan mengekstrak metadata, fileHash, serta baris detail data + rowHash
 */
const parseProductionExcel = (fileBuffer) => {
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    let processTimestamp = 'UNKNOWN';
    if (rawData[0] && rawData[0][9]) {
        const rawHeader = String(rawData[0][9]);
        processTimestamp = rawHeader.replace('Proses :', '').trim();
    }

    const rawRows = [];

    for (let i = 6; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        // B = index 1, E = index 4, F = index 5, J = index 9, N = index 13
        const batchNumber = row[1] ? String(row[1]).trim() : '';
        const lotNumber = row[4] ? String(row[4]).trim() : '';
        const itemCode = row[5] ? String(row[5]).trim() : '';
        const lotStatus = row[9] ? String(row[9]).trim() : '';
        const qtyPac = parseInt(row[13], 10) || 0;

        if (!batchNumber || batchNumber === 'Batch Num.' || batchNumber === 'SubTot') {
            continue;
        }

        // Q = index 16, R = index 17 | S = index 18, T = index 19
        const startDatetime = parseExcelDateTime(row[16], row[17]);
        const completedDatetime = parseExcelDateTime(row[18], row[19]);

        // lotStatus dihapus dari hashPayload agar perubahan status tidak mengubah identitas baris
        const hashPayload = [
            batchNumber,
            lotNumber,
            itemCode,
            qtyPac,
            startDatetime || '',
            completedDatetime || ''
        ].join('|');

        const rowHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

        rawRows.push({
            batchNumber,
            lotNumber,
            itemCode,
            lotStatus,
            qtyPac,
            actualStartDatetime: startDatetime,
            actualCompletedDatetime: completedDatetime,
            rowHash
        });
    }

    return {
        processTimestamp,
        fileHash,
        rawRows
    };
};

module.exports = {
    parseExcelDateTime,
    parseProductionExcel
};
