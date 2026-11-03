const crypto = require('crypto');
const { BusinessError } = require('../../helpers/businessError');
const { MAX_UPLOAD_ROWS } = require('../../helpers/uploadConfig');
const { readUploadSheet, parseExcelDateTime, parseDateOnly, parseQuantity } = require('../../helpers/excelUploadReader');
const { MATCH_BY } = require('../upload-trans-type/uploadTransTypeRules');

/**
 * @param {Buffer} fileBuffer
 * @param {(rawText: string) => object|undefined} findRule pencari aturan jenis transaksi (scope LOT, lihat uploadTransTypeLoader)
 */
const parseProductionExcel = (fileBuffer, findRule) => {
    const { fileHash, processTimestamp, rows } = readUploadSheet(fileBuffer);

    const rawRows = [];

    for (const { cells: row, excelRowNumber } of rows) {
        // Jenis transaksi dikenali lewat daftar aktif di database (tidak peka huruf besar/kecil)
        const rule = findRule(row[1]);
        if (!rule) {
            continue;
        }

        const transType = rule.label;
        const status = row[2] ? String(row[2]).trim() : ''; // Kolom C
        const transDateRaw = row[3];                         // Kolom D (Trans Date)
        const itemCode = row[4] ? String(row[4]).trim() : '';  // Kolom E (Item)

        // Kolom G (Doc Source) -> hapus awalan BATCH (case-insensitive).
        // Jenis berbasis lot tidak memakai batch: kolom G hanya disimpan sebagai referensi (docSource).
        let docSource = row[6] ? String(row[6]).trim() : '';
        if (docSource.toUpperCase().startsWith('BATCH')) {
            docSource = docSource.replace(/^BATCH/i, '').trim();
        }
        const matchBy = rule.matchBy;
        const batchNumber = matchBy === MATCH_BY.LOT ? '' : docSource;

        const lotNumber = row[11] ? String(row[11]).trim() : ''; // Kolom L (Lot Num)
        const expDateRaw = row[15];                             // Kolom P (Exp Date)

        // Kolom qty ditentukan arah jenis: IN = Q (index 16), OUT = T (index 19)
        const rawQty = row[rule.qtyColumn];
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
            matchBy,
            // Referensi saja untuk jenis lot-item (tidak dipakai mencocokkan dan tidak masuk hash)
            docSource: matchBy === MATCH_BY.LOT ? docSource : '',
            qtyPac: storedQtyPac,
            rawAllocationQty: rule.sign * storedQtyPac,
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
