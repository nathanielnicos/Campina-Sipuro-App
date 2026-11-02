'use strict';

/**
 * Pembaca file Excel laporan "Running Stock" (RORCWMS06) yang dipakai fitur upload.
 * Hanya utilitas generik: hash file, process timestamp (K1), baris data (mulai baris 7),
 * serta pembaca tanggal dan qty. Aturan bisnis per fitur (jenis transaksi, kolom yang diambil)
 * ada di parser fitur masing-masing.
 */

const xlsx = require('xlsx');
const crypto = require('crypto');
const { BusinessError } = require('./businessError');

const DATA_START_INDEX = 6; // baris ke-7 pada Excel
const pad = (n) => String(n).padStart(2, '0');

const MONTHS = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

/**
 * Tanggal dan jam dari sel Excel menjadi 'YYYY-MM-DD HH:mm:ss' (tanpa menggeser zona waktu).
 * Menerima serial number Excel, teks "DD-Mon-YYYY [HH:mm[:ss]]", atau teks tanggal standar. Salah -> null.
 */
const parseExcelDateTime = (excelDateVal) => {
    if (excelDateVal === undefined || excelDateVal === null || excelDateVal === '') return null;

    if (typeof excelDateVal === 'number') {
        const dateObj = xlsx.SSF.parse_date_code(excelDateVal);
        if (dateObj) {
            return `${dateObj.y}-${pad(dateObj.m)}-${pad(dateObj.d)} ${pad(dateObj.H || 0)}:${pad(dateObj.M || 0)}:${pad(Math.floor(dateObj.S || 0))}`;
        }
    }

    const strVal = String(excelDateVal).trim();

    const match = strVal.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
        const month = MONTHS[match[2].toLowerCase()];
        if (month) {
            return `${match[3]}-${month}-${pad(match[1])} ${pad(match[4] || 0)}:${pad(match[5] || 0)}:${pad(match[6] || 0)}`;
        }
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

/**
 * Qty dari sel Excel. Tanda dipertahankan (penolakan qty negatif adalah aturan fitur, bukan pembaca).
 * isWhole=false bila desimal atau bukan angka.
 */
const parseQuantity = (raw) => {
    if (raw === undefined || raw === null) return { value: 0, isWhole: true };
    if (typeof raw === 'number') {
        return Number.isFinite(raw) ? { value: raw, isWhole: Number.isInteger(raw) } : { value: 0, isWhole: false };
    }
    const text = String(raw).trim();
    if (text === '') return { value: 0, isWhole: true };
    if (/^[+-]?\d+$/.test(text)) return { value: parseInt(text, 10), isWhole: true };
    if (/^[+-]?\d+\.\d+$/.test(text)) return { value: parseFloat(text), isWhole: false };
    return { value: 0, isWhole: false };
};

/**
 * Membaca sheet pertama: hash file, process timestamp (K1), dan baris data (baris ke-7 dst).
 * @returns {{ fileHash: string, processTimestamp: string, rows: Array<{ cells: any[], excelRowNumber: number }> }}
 */
const readUploadSheet = (fileBuffer) => {
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let rawData;
    let worksheet;
    let firstSheetRow = 0;
    try {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (worksheet && worksheet['!ref']) {
            firstSheetRow = xlsx.utils.decode_range(worksheet['!ref']).s.r;
        }
        rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    } catch (err) {
        throw new BusinessError('The file could not be read as an Excel workbook.', 400);
    }

    let processTimestamp = '';
    if (worksheet && worksheet['K1']) {
        processTimestamp = String(worksheet['K1'].w || worksheet['K1'].v || '').trim();
    } else if (rawData[0] && rawData[0][10]) {
        processTimestamp = String(rawData[0][10]).trim();
    }
    if (!processTimestamp) {
        throw new BusinessError('Process timestamp not found in file header (Cell K1).', 422);
    }

    const rows = [];
    for (let i = DATA_START_INDEX; i < rawData.length; i++) {
        if (!rawData[i]) continue;
        rows.push({ cells: rawData[i], excelRowNumber: i + 1 + firstSheetRow });
    }

    return { fileHash, processTimestamp, rows };
};

module.exports = { parseExcelDateTime, parseDateOnly, parseQuantity, readUploadSheet };
