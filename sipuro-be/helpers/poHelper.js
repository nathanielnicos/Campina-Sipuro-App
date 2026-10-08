const { sipuroDb } = require('../config/db');
const { getWibYear, getWibDateTimeString } = require('./dateHelper');

function calculateBaseQty(qty, uom, product) {
    const uppercaseUom = (uom || '').toUpperCase();
    const pcsPerCtn = product ? Number(product.pcs_per_ctn || 1) : 1;
    const ctnPerPlt = product ? Number(product.ctn_per_plt || 1) : 1;

    if (uppercaseUom === 'CTN') {
        return qty * pcsPerCtn;
    } else if (uppercaseUom === 'PLT') {
        return qty * pcsPerCtn * ctnPerPlt;
    }
    return qty;
};

async function generateNextPoNumber(connection, { customer_id, customerCode }) {
    const db = connection || sipuroDb;

    // 1. Fetch customer code
    let finalCustomerCode = customerCode;
    if (!finalCustomerCode && customer_id) {
        const [custRows] = await db.query(
            `SELECT customer_code FROM sipuro_db.customers WHERE customer_id = ?`,
            [customer_id]
        );
        finalCustomerCode = custRows.length > 0 && custRows[0].customer_code ? custRows[0].customer_code : 'CUST';
    }
    if (!finalCustomerCode) finalCustomerCode = 'CUST';

    // 2. Fetch PO settings
    const [settingRows] = await db.query(
        `SELECT template_pattern, reset_cycle FROM sipuro_db.po_settings ORDER BY setting_id DESC LIMIT 1`
    );

    const templatePattern = (settingRows.length > 0 && settingRows[0].template_pattern)
        ? settingRows[0].template_pattern
        : '{xxx}/PO/{customer_code}/{year}';

    const resetCycle = (settingRows.length > 0 && settingRows[0].reset_cycle)
        ? settingRows[0].reset_cycle
        : 'YEARLY';

    // 3. Detect sequence placeholder
    const seqMatch = templatePattern.match(/\{(x+|sequence)\}/i);
    let minDigits = 3;
    let seqPlaceholder = '{xxx}';

    if (seqMatch) {
        seqPlaceholder = seqMatch[0];
        const token = seqMatch[1].toLowerCase();
        minDigits = token === 'sequence' ? 3 : token.length;
    }

    // 4. WIB Date calculations
    const nowWibStr = getWibDateTimeString();
    const nowWibDate = new Date(nowWibStr.replace(' ', 'T') + '+07:00');

    const yearFull = String(nowWibDate.getFullYear());
    const yearShort = yearFull.slice(-2);
    const month = String(nowWibDate.getMonth() + 1).padStart(2, '0');
    const monthSingle = String(nowWibDate.getMonth() + 1);
    const date = String(nowWibDate.getDate()).padStart(2, '0');
    const dateSingle = String(nowWibDate.getDate());
    const hour = String(nowWibDate.getHours()).padStart(2, '0');
    const min = String(nowWibDate.getMinutes()).padStart(2, '0');
    const sec = String(nowWibDate.getSeconds()).padStart(2, '0');

    // 5. Query PO Numbers diurutkan dari created_at TERBARU
    let dateWhereClause = '';
    const queryParams = [];

    if (resetCycle === 'YEARLY') {
        dateWhereClause = 'WHERE YEAR(created_at) = ?';
        queryParams.push(getWibYear());
    } else if (resetCycle === 'MONTHLY') {
        dateWhereClause = 'WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?';
        queryParams.push(getWibYear(), parseInt(month, 10));
    }

    const [allPoRows] = await db.query(
        `SELECT po_number FROM sipuro_db.po_headers ${dateWhereClause} ORDER BY created_at DESC, po_header_id DESC`,
        queryParams
    );

    let lastSeq = 0;

    // Buat regex matcher berdasarkan templatePattern
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let regexPatternStr = '^' + escapeRegex(templatePattern)
        .replace(/\\\{x+\\\}|\\\{sequence\\\}/gi, '(\\d+)')
        .replace(/\\\{customer_code\\\}/gi, '.*?')
        .replace(/\\\{customer_id\\\}/gi, '.*?')
        .replace(/\\\{year\\\}|\\\{yyyy\\\}/gi, '\\d{4}')
        .replace(/\\\{yy\\\}/gi, '\\d{2}')
        .replace(/\\\{month\\\}|\\\{mm\\\}/gi, '\\d{2}')
        .replace(/\\\{m\\\}/gi, '\\d{1,2}')
        .replace(/\\\{date\\\}|\\\{dd\\\}/gi, '\\d{2}')
        .replace(/\\\{d\\\}/gi, '\\d{1,2}')
        .replace(/\\\{hour\\\}|\\\{hh\\\}/gi, '\\d{2}')
        .replace(/\\\{min\\\}/gi, '\\d{2}')
        .replace(/\\\{sec\\\}|\\\{ss\\\}/gi, '\\d{2}') + '$';

    const matchRegex = new RegExp(regexPatternStr, 'i');

    // Ambil angka sekuensial dari transaksi teratas (created_at terbaru)
    for (const row of allPoRows) {
        if (!row.po_number) continue;

        const match = row.po_number.match(matchRegex);
        if (match && match[1]) {
            const parsedNum = parseInt(match[1], 10);
            if (!isNaN(parsedNum)) {
                lastSeq = parsedNum;
                break; // Berhenti di record terbaru yang cocok
            }
        } else {
            // Fallback jika format lama beda: ambil bagian angka non-tahun
            const parts = row.po_number.split(/[\/\-_]/);
            for (const part of parts) {
                if (/^\d+$/.test(part) && part.length !== 4 && part.length !== 6) {
                    const parsedNum = parseInt(part, 10);
                    if (!isNaN(parsedNum)) {
                        lastSeq = parsedNum;
                        break;
                    }
                }
            }
            if (lastSeq > 0) break;
        }
    }

    const nextSeq = lastSeq + 1;
    const formattedSeq = String(nextSeq).padStart(minDigits, '0');

    // 6. Replace placeholders
    let finalPoNumber = templatePattern
        .replace(seqPlaceholder, formattedSeq)
        .replace(/\{customer_code\}/gi, finalCustomerCode)
        .replace(/\{customer_id\}/gi, String(customer_id || ''))
        .replace(/\{year\}/gi, yearFull)
        .replace(/\{yyyy\}/gi, yearFull)
        .replace(/\{yy\}/gi, yearShort)
        .replace(/\{month\}/gi, month)
        .replace(/\{mm\}/gi, month)
        .replace(/\{m\}/gi, monthSingle)
        .replace(/\{date\}/gi, date)
        .replace(/\{dd\}/gi, date)
        .replace(/\{d\}/gi, dateSingle)
        .replace(/\{hour\}/gi, hour)
        .replace(/\{hh\}/gi, hour)
        .replace(/\{min\}/gi, min)
        .replace(/\{sec\}/gi, sec)
        .replace(/\{ss\}/gi, sec);

    return {
        poNumber: finalPoNumber,
        nextSeq: nextSeq
    };
}

module.exports = {
    calculateBaseQty,
    generateNextPoNumber
};
