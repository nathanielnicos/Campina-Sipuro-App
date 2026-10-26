const xlsx = require('xlsx');
const crypto = require('crypto');
const { BusinessError } = require('../../helpers/businessError');
const { MAX_UPLOAD_ROWS } = require('../../helpers/uploadConfig');

const pad = (n) => String(n).padStart(2, '0');

/**
 * Parsing tanggal & waktu dari Excel secara presisi ke format 'YYYY-MM-DD HH:mm:ss'
 * Mencegah hilangnya komponen jam:menit:detik pada serial number Excel
 */
const parseExcelDateTime = (excelDateVal) => {
    if (excelDateVal === undefined || excelDateVal === null || excelDateVal === '') return null;

    // 1. Jika serial number Excel (termasuk desimal waktu)
    if (typeof excelDateVal === 'number') {
        const dateObj = xlsx.SSF.parse_date_code(excelDateVal);
        if (dateObj) {
            const y = dateObj.y;
            const m = pad(dateObj.m);
            const d = pad(dateObj.d);
            const hh = pad(dateObj.H || 0);
            const mm = pad(dateObj.M || 0);
            const ss = pad(Math.floor(dateObj.S || 0));
            return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
        }
    }

    const strVal = String(excelDateVal).trim();

    // 2. Jika format string "DD-Mon-YYYY HH:mm:ss" atau "DD-Mon-YYYY"
    const match = strVal.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
        const d = pad(match[1]);
        const monthMap = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
        };
        const m = monthMap[match[2].toLowerCase()];
        const y = match[3];
        const hh = match[4] ? pad(match[4]) : '00';
        const mm = match[5] ? pad(match[5]) : '00';
        const ss = match[6] ? pad(match[6]) : '00';
        if (m) return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }

    // 3. Fallback standar JS Date
    const parsedDate = new Date(strVal);
    if (!isNaN(parsedDate.getTime())) {
        return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}:${pad(parsedDate.getSeconds())}`;
    }

    return null;
};

const parseDateOnly = (val) => {
    const dt = parseExcelDateTime(val);
    return dt ? dt.split(' ')[0] : null;
};

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

const parseProductionExcel = (fileBuffer) => {
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let rawData;
    let worksheet;
    let firstSheetRow = 0;
    try {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        worksheet = workbook.Sheets[sheetName];
        if (worksheet && worksheet['!ref']) {
            firstSheetRow = xlsx.utils.decode_range(worksheet['!ref']).s.r;
        }
        rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    } catch (err) {
        throw new BusinessError('The file could not be read as an Excel workbook.', 400);
    }

    // Ambil Cell K1 (Cell K1 ada di row 0, col 10 atau via worksheet['K1'])
    let processTimestamp = '';
    if (worksheet && worksheet['K1']) {
        processTimestamp = String(worksheet['K1'].w || worksheet['K1'].v || '').trim();
    } else if (rawData[0] && rawData[0][10]) {
        processTimestamp = String(rawData[0][10]).trim();
    }

    if (!processTimestamp) {
        throw new BusinessError('Process timestamp not found in file header (Cell K1).', 422);
    }

    const rawRows = [];
    const invalidQtyRows = [];

    // Mulai dari baris ke-7 (index 6)
    for (let i = 6; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const rawTransType = row[1] ? String(row[1]).trim() : '';
        const transTypeNormalized = rawTransType.toLowerCase();

        // Dynamic Case-Insensitive Filter
        const isCompletion = transTypeNormalized === 'wip completion';
        const isReturn = transTypeNormalized === 'wip completion return';

        if (!isCompletion && !isReturn) {
            continue;
        }

        const transType = isCompletion ? 'WIP Completion' : 'WIP Completion Return';
        const status = row[2] ? String(row[2]).trim() : ''; // Kolom C
        const transDateRaw = row[3];                         // Kolom D (Trans Date)
        const itemCode = row[4] ? String(row[4]).trim() : '';  // Kolom E (Item)

        // Kolom G (Doc Source) -> hapus awalan BATCH (case-insensitive)
        let docSource = row[6] ? String(row[6]).trim() : '';
        if (docSource.toUpperCase().startsWith('BATCH')) {
            docSource = docSource.replace(/^BATCH/i, '').trim();
        }
        const batchNumber = docSource;

        const lotNumber = row[11] ? String(row[11]).trim() : ''; // Kolom L (Lot Num)
        const expDateRaw = row[15];                             // Kolom P (Exp Date)

        const excelRowNumber = i + 1 + firstSheetRow;

        // WIP Completion: Col Q (index 16), WIP Completion Return: Col T (index 19)
        const rawQty = isCompletion ? row[16] : row[19];
        const qtyResult = parseStrictInteger(rawQty);

        if (qtyResult.error) {
            invalidQtyRows.push(`${excelRowNumber} ("${String(rawQty).trim()}")`);
        }
        const qtyPac = qtyResult.error ? 0 : qtyResult.value;
        const storedQtyPac = Math.abs(qtyPac);

        const actualCompletedDatetime = parseExcelDateTime(transDateRaw);
        const expiredDate = parseDateOnly(expDateRaw);

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
            qtyPac: storedQtyPac,
            rawAllocationQty: isReturn ? -storedQtyPac : storedQtyPac,
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
