const xlsx = require('xlsx');
const crypto = require('crypto');
const { BusinessError } = require('../businessError');
const { MAX_UPLOAD_ROWS } = require('../uploadConfig');

const pad = (n) => String(n).padStart(2, '0');

const parseExcelDateTime = (excelDateVal) => {
    if (!excelDateVal) return null;
    if (typeof excelDateVal === 'number') {
        const dateObj = xlsx.SSF.parse_date_code(excelDateVal);
        if (dateObj) {
            return `${dateObj.y}-${pad(dateObj.m)}-${pad(dateObj.d)} ${pad(dateObj.H || 0)}:${pad(dateObj.M || 0)}:${pad(Math.floor(dateObj.S || 0))}`;
        }
    }
    const strVal = String(excelDateVal).trim();
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
    if (typeof raw === 'number') return Number.isInteger(raw) ? { value: raw } : { error: true };
    const text = String(raw).trim();
    if (/^[+-]?\d+$/.test(text)) return { value: parseInt(text, 10) };
    return { error: true };
};

const parseDeliveryOrderExcel = (fileBuffer) => {
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

    // Cell K1 untuk tanggal penarikan / process timestamp
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
    const missingDoRows = [];

    // Data mulai baris ke-7 (index 6)
    for (let i = 6; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const rawTransType = row[1] ? String(row[1]).trim() : ''; // Kolom B
        const normTransType = rawTransType.toLowerCase();

        // Aturan Baru: Hanya terima 'sales order issue' dan 'rma receipt'
        const isIssue = normTransType === 'sales order issue';
        const isRma = normTransType === 'rma receipt';

        if (!isIssue && !isRma) {
            continue;
        }

        const transType = isIssue ? 'Sales order issue' : 'RMA Receipt';
        const status = row[2] ? String(row[2]).trim() : '';       // Kolom C
        const transDateRaw = row[3];                               // Kolom D
        const itemCode = row[4] ? String(row[4]).trim() : '';        // Kolom E
        const lotNumber = row[11] ? String(row[11]).trim() : '';    // Kolom L
        const shipmentNum = row[25] ? String(row[25]).trim() : '';  // Kolom Z

        const excelRowNumber = i + 1 + firstSheetRow;

        if (!shipmentNum) {
            missingDoRows.push(excelRowNumber);
            continue;
        }

        let qtyIn = 0;
        let qtyOut = 0;
        let qtyToProcess = 0;

        if (isIssue) {
            // PENGIRIMAN: Ambil dari Kolom T (Qty Out), nilai POSITIF
            const parsed = parseStrictInteger(row[19]);
            if (parsed.error) invalidQtyRows.push(`${excelRowNumber} Qty Out ("${row[19]}")`);
            qtyOut = Math.abs(parsed.value || 0);
            qtyToProcess = qtyOut;
        } else {
            // RETUR (RMA): Ambil dari Kolom Q (Qty In)
            const parsed = parseStrictInteger(row[16]);
            if (parsed.error) invalidQtyRows.push(`${excelRowNumber} Qty In ("${row[16]}")`);
            qtyIn = Math.abs(parsed.value || 0);
            qtyToProcess = -qtyIn; // Ditandai minus
        }

        const transDate = parseDateOnly(transDateRaw);
        const transDateTime = parseExcelDateTime(transDateRaw);

        const hashPayload = [
            shipmentNum,
            itemCode,
            lotNumber,
            transType,
            qtyIn,
            qtyOut,
            transDateTime || ''
        ].join('|');

        const rowHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

        rawRows.push({
            shipmentNum,
            transType,
            lotStatus: status,
            transDate,
            transDateTime,
            itemCode,
            lotNumber,
            qtyIn,
            qtyOut,
            qtyToProcess,
            rowHash,
            excelRowNumber
        });
    }

    if (missingDoRows.length > 0) {
        throw new BusinessError(
            `Shipment Number (Column Z) is required but missing on row(s): ${missingDoRows.slice(0, 15).join(', ')}.`,
            422
        );
    }

    if (invalidQtyRows.length > 0) {
        throw new BusinessError(
            `Quantity must be valid whole numbers on row(s): ${invalidQtyRows.slice(0, 15).join(', ')}.`,
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
    parseDeliveryOrderExcel
};
