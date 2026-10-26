const xlsx = require('xlsx');
const crypto = require('crypto');
const { BusinessError } = require('../businessError');
const { MAX_UPLOAD_ROWS } = require('./salesInvoiceConfig');

const pad2 = (n) => String(n).padStart(2, '0');

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const parseDateValue = (raw) => {
    if (raw === undefined || raw === null || raw === '') return null;

    if (typeof raw === 'number') {
        const parts = xlsx.SSF.parse_date_code(raw);
        if (!parts) return null;
        return `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}`;
    }

    const text = String(raw).trim();
    // Format YYYY-MM-DD
    let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    // Format D-Mon-YY / D-Mon-YYYY (contoh: 06-Jul-26)
    m = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})/);
    if (m) {
        const mo = MONTHS[m[2].toLowerCase()];
        const d = pad2(m[1]);
        const y = m[3].length === 2 ? `20${m[3]}` : m[3];
        if (mo) return `${y}-${pad2(mo)}-${d}`;
    }

    // Format DD/MM/YYYY
    m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;

    return null;
};

const parseQuantity = (raw) => {
    if (raw === undefined || raw === null || raw === '') return 0;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    const text = String(raw).trim().replace(/,/g, '');
    const num = Number(text);
    return Number.isFinite(num) ? num : 0;
};

const findProcessTimestamp = (rawData) => {
    const limit = Math.min(rawData.length, 6);
    for (let i = 0; i < limit; i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
            const match = String(cell || '').match(/^\s*Proses\s*:\s*(.+?)\s*$/i);
            if (match) return match[1].trim();
        }
    }
    return '';
};

const normalizeHeader = (val) => String(val || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

const parseSalesInvoiceExcel = (fileBuffer) => {
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    let rawData;
    let firstSheetRow = 0;
    try {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (sheet && sheet['!ref']) {
            firstSheetRow = xlsx.utils.decode_range(sheet['!ref']).s.r;
        }
        rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    } catch (err) {
        throw new BusinessError('The file could not be read as an Excel workbook.', 400);
    }

    const processTimestamp = findProcessTimestamp(rawData);
    if (!processTimestamp) {
        throw new BusinessError('Process timestamp not found in file header (Proses: ...).', 422);
    }

    // Cari baris header
    let headerRowIndex = -1;
    let colMap = {};
    for (let i = 0; i < Math.min(rawData.length, 25); i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;
        const norm = row.map(normalizeHeader);

        const itemIdx = norm.findIndex(h => h === 'item');
        const doIdx = norm.findIndex(h => h.includes('delivery no') || h === 'delivery number');
        const siIdx = norm.findIndex(h => h.includes('invoice no') || h === 'invoice number');

        if (itemIdx !== -1 && doIdx !== -1 && siIdx !== -1) {
            headerRowIndex = i;
            colMap = {
                itemCode: itemIdx,
                doNumber: doIdx,
                invoiceNumber: siIdx,
                deliveryStatus: norm.findIndex(h => h === 'delivery status'),
                pickUpDate: norm.findIndex(h => h.includes('pick up date') || h === 'pickup date'),
                qtyInvoice: norm.findIndex(h => h.includes('qty invoice')),
                glDate: norm.findIndex(h => h === 'gl date'),
                customerPo: norm.findIndex(h => h === 'customer po')
            };
            break;
        }
    }

    if (headerRowIndex === -1) {
        throw new BusinessError('Required columns (Item, Delivery No., Invoice No.) not found in Excel header.', 422);
    }

    const rows = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;

        const itemCode = String(row[colMap.itemCode] || '').trim();
        const doNumber = String(row[colMap.doNumber] || '').trim();
        const invoiceNumber = String(row[colMap.invoiceNumber] || '').trim();
        const deliveryStatus = String(row[colMap.deliveryStatus] || '').trim();
        const customerPoText = colMap.customerPo !== -1 ? String(row[colMap.customerPo] || '').trim() : '';

        // Abaikan baris subtotal atau baris kosong
        if (!itemCode || !doNumber || itemCode.toUpperCase().includes('SUBTOT') || itemCode.toUpperCase().includes('GRAND TOTAL')) {
            continue;
        }

        const qtyCtn = parseQuantity(row[colMap.qtyInvoice]);
        const siDate = parseDateValue(row[colMap.glDate]);
        const pickUpDate = parseDateValue(row[colMap.pickUpDate]);

        rows.push({
            excelRowNumber: i + 1 + firstSheetRow,
            itemCode,
            doNumber,
            invoiceNumber,
            deliveryStatus,
            customerPoText,
            qtyCtn,
            siDate,
            pickUpDate
        });
    }

    if (rows.length > MAX_UPLOAD_ROWS) {
        throw new BusinessError(`The file contains ${rows.length} rows. Maximum allowed is ${MAX_UPLOAD_ROWS}.`, 422);
    }

    return { fileHash, processTimestamp, rows };
};

module.exports = { parseSalesInvoiceExcel };
