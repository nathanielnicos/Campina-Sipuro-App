const xlsx = require('xlsx');
const crypto = require('crypto');
const { BusinessError } = require('../businessError');
const { MAX_UPLOAD_ROWS } = require('../uploadConfig');

/**
 * Helper untuk memparsing tanggal teks format "DD-Mon-YYYY" atau Excel serial number ke format SQL (YYYY-MM-DD)
 */
const parseDateValue = (val) => {
    if (!val) return null;
    if (typeof val === 'number') {
        const dateObj = xlsx.SSF.parse_date_code(val);
        if (dateObj) {
            const y = dateObj.y;
            const m = String(dateObj.m).padStart(2, '0');
            const d = String(dateObj.d).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }
    const strVal = String(val).trim();
    // Mendukung format DD-Mon-YYYY (contoh: 06-Oct-2028)
    const match = strVal.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (match) {
        const d = match[1].padStart(2, '0');
        const monthMap = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const mStr = match[2].toLowerCase();
        const m = monthMap[mStr];
        const y = match[3];
        if (m) {
            return `${y}-${m}-${d}`;
        }
    }
    const parsedDate = new Date(strVal);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
    }
    return null;
};

/**
 * Helper untuk memformat tanggal & jam dari Excel secara aman ke format SQL DATETIME (YYYY-MM-DD HH:mm:ss)
 */
const parseExcelDateTime = (excelDateVal, excelTimeVal) => {
    if (!excelDateVal) return null;

    let dateStr = parseDateValue(excelDateVal);
    if (!dateStr) return null;

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
    } else {
        // Jika string mencakup waktu (contoh: "07-Oct-2026 05:57:20")
        const strVal = String(excelDateVal).trim();
        const timeMatch = strVal.match(/\d{2}:\d{2}(?::\d{2})?/);
        if (timeMatch) {
            timeStr = timeMatch[0].length === 5 ? `${timeMatch[0]}:00` : timeMatch[0];
        }
    }

    return `${dateStr} ${timeStr}`;
};

/**
 * Parse qty menjadi bilangan bulat secara ketat.
 */
const parseStrictInteger = (raw) => {
    if (raw === undefined || raw === null) return { value: 0 };
    if (typeof raw === 'string' && raw.trim() === '') return { value: 0 };

    if (typeof raw === 'number') {
        return Number.isInteger(raw) ? { value: raw } : { error: true };
    }

    const text = String(raw).trim();
    if (/^[+-]?\d+$/.test(text)) return { value: parseInt(text, 10) };
    return { error: true };
};

/**
 * Membaca buffer file Excel baru dan mengekstrak data berdasarkan aturan kolom yang ditentukan.
 */
const parseProductionExcel = (fileBuffer) => {
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let rawData;
    let firstSheetRow = 0;
    try {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        if (worksheet && worksheet['!ref']) {
            firstSheetRow = xlsx.utils.decode_range(worksheet['!ref']).s.r;
        }
        rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    } catch (err) {
        throw new BusinessError('The file could not be read as an Excel workbook.', 400);
    }

    // Cell K1 -> index 10 (A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10)
    let processTimestamp = '';
    if (rawData[0] && rawData[0][10]) {
        processTimestamp = String(rawData[0][10]).trim();
    }

    if (!processTimestamp) {
        throw new BusinessError('Process timestamp not found in file header (Cell K1).', 422);
    }

    const rawRows = [];
    const invalidQtyRows = [];

    // Mulai dari baris ke-7 Excel (index 6)
    for (let i = 6; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const transType = row[1] ? String(row[1]).trim() : ''; // Kolom B
        const status = row[2] ? String(row[2]).trim() : '';    // Kolom C

        // Filter: Hanya ambil Trans Type tertentu dan Status harus "GOOD"
        if (transType !== 'WIP Completion' && transType !== 'WIP Completion Return') {
            continue;
        }
        if (status !== 'GOOD') {
            continue;
        }

        const transDateRaw = row[3];                           // Kolom D (Trans Date)
        const itemCode = row[4] ? String(row[4]).trim() : '';  // Kolom E (Item)
        
        // Kolom G (Doc Source) sebagai nomor batch, hapus teks "BATCH" di depannya jika ada
        let docSource = row[6] ? String(row[6]).trim() : '';
        if (docSource.toUpperCase().startsWith('BATCH')) {
            docSource = docSource.replace(/^BATCH/i, '').trim();
        }
        const batchNumber = docSource;

        const lotNumber = row[11] ? String(row[11]).trim() : ''; // Kolom L (Lot Num)
        const expDateRaw = row[15];                              // Kolom P (Exp Date)

        const excelRowNumber = i + 1 + firstSheetRow;

        // Ambil Qty:
        // - WIP Completion -> Kolom Q (index 16)
        // - WIP Completion Return -> Kolom T (index 19)
        let rawQty = 0;
        if (transType === 'WIP Completion') {
            rawQty = row[16];
        } else if (transType === 'WIP Completion Return') {
            rawQty = row[19];
        }

        const qtyResult = parseStrictInteger(rawQty);
        if (qtyResult.error) {
            invalidQtyRows.push(`${excelRowNumber} ("${String(rawQty).trim()}")`);
        }
        const qtyPac = qtyResult.error ? 0 : qtyResult.value;

        // Simpan nilai positif absolut untuk baris database & rowHash (menjaga pencegahan duplikat upload baris persis)
        const storedQtyPac = Math.abs(qtyPac);

        const actualCompletedDatetime = parseExcelDateTime(transDateRaw, null);
        const expiredDate = parseDateValue(expDateRaw);

        const hashPayload = [
            batchNumber,
            lotNumber,
            itemCode,
            transType,
            storedQtyPac,
            actualCompletedDatetime || '',
            expiredDate || ''
        ].join('|');

        const rowHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

        rawRows.push({
            batchNumber,
            lotNumber,
            itemCode,
            lotStatus: status,
            transType,
            qtyPac: storedQtyPac,         // Disimpan positif sesuai format file untuk log/tabel detail
            rawAllocationQty: transType === 'WIP Completion Return' ? -Math.abs(qtyPac) : qtyPac, // Disiapkan negatif untuk WIP Completion Return saat di-sum ke alokasi PO
            actualCompletedDatetime,
            expiredDate,
            rowHash,
            excelRowNumber
        });
    }

    if (invalidQtyRows.length > 0) {
        const shown = invalidQtyRows.slice(0, 20).join(', ');
        const more = invalidQtyRows.length > 20 ? ` and ${invalidQtyRows.length - 20} more` : '';
        throw new BusinessError(
            `Quantity must be a whole number. Please fix Excel row(s): ${shown}${more}.`,
            422
        );
    }

    if (rawRows.length > MAX_UPLOAD_ROWS) {
        throw new BusinessError(
            `The file contains ${rawRows.length} data rows. The maximum allowed per upload is ${MAX_UPLOAD_ROWS} rows.`,
            422
        );
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
