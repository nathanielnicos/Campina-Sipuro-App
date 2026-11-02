'use strict';

/**
 * Parser file Excel Delivery Order (Sales order issue) dan retur (RMA Receipt).
 * Tata letak file sama dengan upload lot; hanya kolom yang diambil berbeda (lihat COLUMN).
 * Tidak menolak baris di sini kecuali file tidak bisa dibaca atau melebihi batas baris;
 * validasi per baris (nomor, lot, tanggal, qty) dilakukan kalkulator sehingga muncul sebagai Unallocated.
 */

const crypto = require('crypto');
const { BusinessError } = require('../../helpers/businessError');
const { MAX_UPLOAD_ROWS } = require('../../helpers/uploadConfig');
const { readUploadSheet, parseExcelDateTime, parseQuantity } = require('../../helpers/excelUploadReader');
const { TRANS_TYPE, COLUMN } = require('./deliveryOrderRules');

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

const parseDeliveryOrderExcel = (fileBuffer) => {
    const { fileHash, processTimestamp, rows } = readUploadSheet(fileBuffer);

    const rawRows = [];

    for (const { cells, excelRowNumber } of rows) {
        const normalizedType = text(cells[COLUMN.TRANS_TYPE]).toLowerCase();
        const isIssue = normalizedType === TRANS_TYPE.ISSUE.toLowerCase();
        const isReturn = normalizedType === TRANS_TYPE.RETURN.toLowerCase();
        if (!isIssue && !isReturn) continue;

        const transType = isIssue ? TRANS_TYPE.ISSUE : TRANS_TYPE.RETURN;
        // Sales order issue: Qty Out (T); RMA Receipt: Qty In (Q). Tanda qty dipertahankan.
        const rawQty = isIssue ? cells[COLUMN.QTY_OUT] : cells[COLUMN.QTY_IN];
        const qtyResult = parseQuantity(rawQty);

        const referenceNum = text(cells[COLUMN.REFERENCE]);
        const itemCode = text(cells[COLUMN.ITEM]);
        const lotNumber = text(cells[COLUMN.LOT]);
        const transDateTime = parseExcelDateTime(cells[COLUMN.TRANS_DATE]);

        const rowHash = crypto.createHash('sha256').update([
            referenceNum,
            itemCode,
            lotNumber,
            transType,
            qtyResult.value,
            transDateTime || ''
        ].join('|')).digest('hex');

        rawRows.push({
            referenceNum,
            transType,
            lotStatus: text(cells[COLUMN.STATUS]),
            transDateTime,
            itemCode,
            lotNumber,
            qty: qtyResult.value,
            qtyIsWhole: qtyResult.isWhole,
            rawQtyText: text(rawQty),
            rowHash,
            excelRowNumber
        });
    }

    if (rawRows.length > MAX_UPLOAD_ROWS) {
        throw new BusinessError(
            `The file contains ${rawRows.length} data rows. The maximum allowed per upload is ${MAX_UPLOAD_ROWS} rows.`,
            422
        );
    }

    return { processTimestamp, fileHash, rawRows };
};

module.exports = { parseDeliveryOrderExcel };
