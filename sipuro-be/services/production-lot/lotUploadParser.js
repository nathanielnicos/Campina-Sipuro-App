const crypto = require('crypto');
const { BusinessError } = require('../../helpers/businessError');
const { MAX_UPLOAD_ROWS } = require('../../helpers/uploadConfig');
const { readUploadSheet, parseExcelDateTime, parseDateOnly, parseQuantity } = require('../../helpers/excelUploadReader');
const { TRANS_TYPE } = require('./lotAllocationRules');

const parseProductionExcel = (fileBuffer) => {
    const { fileHash, processTimestamp, rows } = readUploadSheet(fileBuffer);

    const rawRows = [];

    for (const { cells: row, excelRowNumber } of rows) {
        const rawTransType = row[1] ? String(row[1]).trim() : '';
        const transTypeNormalized = rawTransType.toLowerCase();

        // Dynamic Case-Insensitive Filter
        const isCompletion = transTypeNormalized === 'wip completion';
        const isReturn = transTypeNormalized === 'wip completion return';

        if (!isCompletion && !isReturn) {
            continue;
        }

        const transType = isCompletion ? TRANS_TYPE.COMPLETION : TRANS_TYPE.RETURN;
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

        // WIP Completion: Col Q (index 16), WIP Completion Return: Col T (index 19)
        const rawQty = isCompletion ? row[16] : row[19];
        const qtyResult = parseQuantity(rawQty);
        const storedQtyPac = Math.abs(qtyResult.value);

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
            excelRowNumber,
            qtyIsWhole: qtyResult.isWhole,
            rawQtyText: String(rawQty === undefined || rawQty === null ? '' : rawQty).trim()
        });
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
    parseQuantity,
    parseExcelDateTime,
    parseProductionExcel
};
