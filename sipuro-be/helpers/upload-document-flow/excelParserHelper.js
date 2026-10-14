const xlsx = require('xlsx');
const { BusinessError } = require('../businessError');
const { generateFileHash } = require('./hashGeneratorHelper');
const { MAX_UPLOAD_ROWS } = require('./documentFlowConfig');

/**
 * Parses the Oracle "List Document Flow" export.
 *
 *  - Columns are found by HEADER NAME (not by position), so a moved column does not break the import.
 *  - The header row is searched in the first rows of the sheet (it is row 5 today; row 6 SubTot and
 *    row 7 Grand Total are skipped).
 *  - Dates are read without any timezone conversion. Values are returned as plain strings:
 *      date      -> 'YYYY-MM-DD'
 *      datetime  -> 'YYYY-MM-DD HH:mm:ss'   (WIB wall-clock, exactly as written in the file)
 *  - Cells that cannot be read are NOT silently replaced; they are reported in `parseErrors`
 *    so the row can be listed under "Rows to Fix".
 */

// Required headers (normalised) with accepted aliases. Key = internal field name.
const REQUIRED_HEADERS = {
    itemCode: { label: 'Item', aliases: ['item'] },
    customerPo: { label: 'Customer PO', aliases: ['customer po'] },
    doNumber: { label: 'Delivery No.', aliases: ['delivery no', 'delivery number'] },
    qtyDelivery: { label: 'Qty Delivery', aliases: ['qty delivery'] },
    deliveryStatus: { label: 'Delivery Status', aliases: ['delivery status'] },
    pickUpDate: { label: 'Pick Up Date', aliases: ['pick up date', 'pickup date'] },
    invoiceNumber: { label: 'Invoice No.', aliases: ['invoice no', 'invoice number'] },
    qtyInvoice: { label: 'Qty Invoice (CAR)', aliases: ['qty invoice (car)', 'qty invoice (ctn)', 'qty invoice'] },
    glDate: { label: 'GL Date', aliases: ['gl date'] },
    doCreationDate: { label: 'DO Creation Date', aliases: ['do creation date'] }
};

const OPTIONAL_HEADERS = {
    grp: { aliases: ['grp'] },
    canceledInvoice: { aliases: ['canceled invoice', 'cancelled invoice'] }
};

const HEADER_SCAN_ROWS = 30;
const SKIP_GROUP_VALUES = new Set(['SUBTOT', 'SUBTOTAL', 'GRAND TOTAL', 'GRANDTOTAL']);

const normalizeHeader = (value) => String(value === undefined || value === null ? '' : value)
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();

const cellText = (value) => (value === undefined || value === null ? '' : String(value).trim());

const pad2 = (n) => String(n).padStart(2, '0');

const isValidYmd = (y, m, d) => {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
    if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return d <= daysInMonth;
};

/**
 * Excel serial number / text -> { date: 'YYYY-MM-DD', time: 'HH:mm:ss' } | { empty:true } | { error:true }
 * Text formats accepted: 'YYYY-MM-DD[ HH:mm[:ss]]', 'D-Mon-YY[YY][ HH:mm[:ss]]' (e.g. 06-Jul-26 09:09:06, English month
 * abbreviations), 'DD/MM/YYYY HH:mm:ss' (24-hour, day first) and 'M/D/YYYY h:mm:ss AM|PM' (older export, month first).
 */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const parseDateValue = (raw) => {
    if (raw === undefined || raw === null) return { empty: true };

    if (typeof raw === 'number') {
        const parts = xlsx.SSF.parse_date_code(raw);
        if (!parts || !isValidYmd(parts.y, parts.m, parts.d)) return { error: true };
        return {
            date: `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}`,
            time: `${pad2(parts.H)}:${pad2(parts.M)}:${pad2(Math.floor(parts.S))}`
        };
    }

    const text = String(raw).trim();
    if (text === '') return { empty: true };

    let m = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
        const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
        if (!isValidYmd(y, mo, d)) return { error: true };
        const hh = m[4] !== undefined ? Number(m[4]) : 0;
        const mm = m[5] !== undefined ? Number(m[5]) : 0;
        const ss = m[6] !== undefined ? Number(m[6]) : 0;
        if (hh > 23 || mm > 59 || ss > 59) return { error: true };
        return { date: `${y}-${pad2(mo)}-${pad2(d)}`, time: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}` };
    }

    // Current export: D-Mon-YY HH:mm:ss, e.g. "06-Jul-26 09:09:06" (24-hour clock; 2-digit year = 20YY)
    m = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
        const mo = MONTHS[m[2].toLowerCase()];
        const d = Number(m[1]);
        const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
        if (!mo || !isValidYmd(y, mo, d)) return { error: true };
        const hh = m[4] !== undefined ? Number(m[4]) : 0;
        const mm = m[5] !== undefined ? Number(m[5]) : 0;
        const ss = m[6] !== undefined ? Number(m[6]) : 0;
        if (hh > 23 || mm > 59 || ss > 59) return { error: true };
        return { date: `${y}-${pad2(mo)}-${pad2(d)}`, time: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}` };
    }

    // Slash formats. Which one it is is decided by the text itself, never by guessing:
    //  - with AM/PM          -> M/D/YYYY h:mm:ss AM|PM   (older Oracle export, month first)
    //  - 24-hour, with time  -> DD/MM/YYYY HH:mm:ss      (current export variant, day first; confirmed by the user)
    //  - slash date WITHOUT a time and WITHOUT AM/PM is ambiguous and is rejected.
    m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if (m) {
        const meridiem = m[7] ? m[7].toUpperCase() : null;
        const hasTime = m[4] !== undefined;
        if (!meridiem && !hasTime) return { error: true };

        const [a1, a2, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const [mo, d] = meridiem ? [a1, a2] : [a2, a1];
        if (!isValidYmd(y, mo, d)) return { error: true };
        let hh = hasTime ? Number(m[4]) : 0;
        const mm = m[5] !== undefined ? Number(m[5]) : 0;
        const ss = m[6] !== undefined ? Number(m[6]) : 0;
        if (meridiem) {
            if (hh < 1 || hh > 12) return { error: true };
            if (meridiem === 'AM' && hh === 12) hh = 0;
            if (meridiem === 'PM' && hh !== 12) hh += 12;
        }
        if (hh > 23 || mm > 59 || ss > 59) return { error: true };
        return { date: `${y}-${pad2(mo)}-${pad2(d)}`, time: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}` };
    }

    return { error: true };
};

// Quantity with at most 2 decimals. Empty -> { empty:true }, invalid -> { error:true }
const parseQuantity = (raw) => {
    if (raw === undefined || raw === null) return { empty: true };
    let num;
    if (typeof raw === 'number') {
        num = raw;
    } else {
        const text = String(raw).trim();
        if (text === '') return { empty: true };
        if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) num = Number(text.replace(/,/g, ''));
        else if (/^-?\d+(\.\d+)?$/.test(text)) num = Number(text);
        else return { error: true };
    }
    if (!Number.isFinite(num)) return { error: true };
    const cents = Math.round(num * 100);
    if (Math.abs(num * 100 - cents) > 1e-6) return { error: true };
    return { value: cents / 100 };
};

/**
 * Finds the header row and maps header names to column indexes.
 */
const locateHeaders = (rawData, firstSheetRow) => {
    const limit = Math.min(rawData.length, HEADER_SCAN_ROWS);
    let best = null;

    for (let i = 0; i < limit; i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;
        const normalized = row.map(normalizeHeader);
        const columns = {};
        let found = 0;

        Object.entries(REQUIRED_HEADERS).forEach(([field, def]) => {
            const idx = normalized.findIndex((h) => def.aliases.includes(h));
            if (idx !== -1) {
                columns[field] = idx;
                found += 1;
            }
        });

        if (found > 0 && (!best || found > best.found)) {
            best = { rowIndex: i, columns, found, normalized };
        }
    }

    const requiredFields = Object.keys(REQUIRED_HEADERS);
    if (!best || best.found < Math.ceil(requiredFields.length / 2)) {
        throw new BusinessError(
            'The header row was not found. Please upload the original "List Document Flow" export without modifying its header.',
            422
        );
    }

    const missing = requiredFields.filter((f) => best.columns[f] === undefined).map((f) => REQUIRED_HEADERS[f].label);
    if (missing.length > 0) {
        throw new BusinessError(`Required column(s) not found in the file header: ${missing.join(', ')}.`, 422);
    }

    Object.entries(OPTIONAL_HEADERS).forEach(([field, def]) => {
        const idx = best.normalized.findIndex((h) => def.aliases.includes(h));
        if (idx !== -1) best.columns[field] = idx;
    });

    return { headerRowIndex: best.rowIndex, columns: best.columns, excelHeaderRow: best.rowIndex + 1 + firstSheetRow };
};

const findProcessTimestamp = (rawData) => {
    const limit = Math.min(rawData.length, 6);
    for (let i = 0; i < limit; i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
            const match = String(cell === undefined || cell === null ? '' : cell).match(/^\s*Proses\s*:\s*(.+?)\s*$/i);
            if (match) return match[1];
        }
    }
    return '';
};

/**
 * @param {Buffer} fileBuffer
 * @returns {{ fileHash:string, processTimestamp:string, rows:object[] }}
 */
const parseDocumentFlowExcel = (fileBuffer) => {
    const fileHash = generateFileHash(fileBuffer);

    let rawData;
    let firstSheetRow = 0;
    try {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (worksheet && worksheet['!ref']) {
            firstSheetRow = xlsx.utils.decode_range(worksheet['!ref']).s.r;
        }
        rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    } catch (err) {
        throw new BusinessError('The file could not be read as an Excel workbook.', 400);
    }

    const processTimestamp = findProcessTimestamp(rawData);
    if (!processTimestamp) {
        throw new BusinessError('Process timestamp not found in file header.', 422);
    }

    const { headerRowIndex, columns } = locateHeaders(rawData, firstSheetRow);
    const rows = [];

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;

        if (columns.grp !== undefined) {
            const grp = cellText(row[columns.grp]).toUpperCase();
            if (SKIP_GROUP_VALUES.has(grp)) continue;
        }

        const get = (field) => (columns[field] === undefined ? undefined : row[columns[field]]);

        const itemCode = cellText(get('itemCode'));
        const customerPoText = cellText(get('customerPo'));
        const doNumber = cellText(get('doNumber'));
        const deliveryStatus = cellText(get('deliveryStatus'));
        const invoiceNumber = cellText(get('invoiceNumber'));
        const canceledInvoice = cellText(get('canceledInvoice')).toUpperCase();

        const qtyDeliveryRaw = get('qtyDelivery');
        const qtyInvoiceRaw = get('qtyInvoice');
        const pickUpRaw = get('pickUpDate');
        const glRaw = get('glDate');
        const doCreationRaw = get('doCreationDate');

        const hasAnyValue = [itemCode, customerPoText, doNumber, deliveryStatus, invoiceNumber].some((v) => v !== '')
            || [qtyDeliveryRaw, qtyInvoiceRaw, pickUpRaw, glRaw, doCreationRaw].some((v) => cellText(v) !== '');
        if (!hasAnyValue) continue;

        const parseErrors = [];

        const qtyDelivery = parseQuantity(qtyDeliveryRaw);
        if (qtyDelivery.error) parseErrors.push({ column: REQUIRED_HEADERS.qtyDelivery.label, message: `Invalid quantity "${cellText(qtyDeliveryRaw)}"` });
        const qtyInvoice = parseQuantity(qtyInvoiceRaw);
        if (qtyInvoice.error) parseErrors.push({ column: REQUIRED_HEADERS.qtyInvoice.label, message: `Invalid quantity "${cellText(qtyInvoiceRaw)}"` });

        const pickUp = parseDateValue(pickUpRaw);
        if (pickUp.error) parseErrors.push({ column: REQUIRED_HEADERS.pickUpDate.label, message: `Invalid date "${cellText(pickUpRaw)}"` });
        const gl = parseDateValue(glRaw);
        if (gl.error) parseErrors.push({ column: REQUIRED_HEADERS.glDate.label, message: `Invalid date "${cellText(glRaw)}"` });
        const doCreation = parseDateValue(doCreationRaw);
        if (doCreation.error) parseErrors.push({ column: REQUIRED_HEADERS.doCreationDate.label, message: `Invalid date/time "${cellText(doCreationRaw)}" (expected e.g. 06-Jul-26 09:09:06 or 06/07/2026 09:09:06)` });

        rows.push({
            excelRowNumber: i + 1 + firstSheetRow,
            itemCode,
            customerPoText,
            doNumber,
            deliveryStatus,
            invoiceNumber,
            canceledInvoice,
            qtyCtnDO: qtyDelivery.value !== undefined ? qtyDelivery.value : null,
            qtyCtnSI: qtyInvoice.value !== undefined ? qtyInvoice.value : null,
            pickUpDate: pickUp.date || null,
            siDate: gl.date || null,
            // DO Creation Date keeps its time because the FIFO rule compares date AND time
            doCreatedAt: doCreation.date ? `${doCreation.date} ${doCreation.time}` : null,
            parseErrors
        });
    }

    if (rows.length > MAX_UPLOAD_ROWS) {
        throw new BusinessError(
            `The file contains ${rows.length} data rows. The maximum allowed per upload is ${MAX_UPLOAD_ROWS} rows.`,
            422
        );
    }

    return { fileHash, processTimestamp, rows };
};

module.exports = { parseDocumentFlowExcel, parseDateValue, parseQuantity, REQUIRED_HEADERS };
