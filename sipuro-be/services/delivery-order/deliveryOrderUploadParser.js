'use strict';

/**
 * Parser file Excel Delivery Order (Sales order issue) dan retur (RMA Receipt).
 * Tata letak file sama dengan upload lot; kolom yang diambil berasal dari format upload scope DO (Setting > Upload Format).
 * Tidak menolak baris di sini kecuali file tidak bisa dibaca atau melebihi batas baris;
 * validasi per baris (nomor, lot, tanggal, qty) dilakukan kalkulator sehingga muncul sebagai Unallocated.
 */

const crypto = require('crypto');
const { BusinessError } = require('../../helpers/businessError');
const { MAX_UPLOAD_ROWS } = require('../../helpers/uploadConfig');
const { readUploadSheet, parseExcelDateTime, parseQuantity } = require('../../helpers/excelUploadReader');
const { TRANS_TYPE } = require('./deliveryOrderRules');
const { DIRECTION } = require('../upload-trans-type/uploadTransTypeRules');
const { createSkippedRowTracker } = require('../upload-trans-type/uploadSkippedRows');

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/**
 * @param {Buffer} fileBuffer
 * @param {(rawText: string) => object|undefined} findRule pencari aturan jenis transaksi (scope DO, lihat uploadTransTypeLoader)
 * @param {{ startRow: number, timestampCell: string, columns: object }} format format file upload (scope DO, lihat uploadFormatLoader)
 */
const parseDeliveryOrderExcel = (fileBuffer, findRule, format) => {
    const { fileHash, processTimestamp, rows } = readUploadSheet(fileBuffer, format);
    const col = format.columns;

    const rawRows = [];
    const skipped = createSkippedRowTracker([TRANS_TYPE.ISSUE, TRANS_TYPE.RETURN]);

    for (const { cells, excelRowNumber } of rows) {
        const rule = findRule(cells[col.TRANS_TYPE]);
        if (!rule) {
            // Jenis wajib DO (Sales Order Issue, RMA Receipt) yang nonaktif dilaporkan di preview; jenis lain dilewati tanpa peringatan
            skipped.add(cells[col.TRANS_TYPE], excelRowNumber);
            continue;
        }

        // Arah OUT = pengiriman (Sales order issue, Qty Out / T); IN = retur (RMA Receipt, Qty In / Q).
        // Nilai transType disimpan memakai nama baku di TRANS_TYPE. Tanda qty dipertahankan.
        const isIssue = rule.direction === DIRECTION.OUT;
        const transType = isIssue ? TRANS_TYPE.ISSUE : TRANS_TYPE.RETURN;
        const rawQty = cells[isIssue ? col.QTY_OUT : col.QTY_IN];
        const qtyResult = parseQuantity(rawQty);

        const referenceNum = text(cells[col.REFERENCE]);
        const itemCode = text(cells[col.ITEM]);
        const lotNumber = text(cells[col.LOT_NUMBER]);
        const transDateTime = parseExcelDateTime(cells[col.TRANS_DATE]);

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
            lotStatus: text(cells[col.STATUS]),
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

    return { processTimestamp, fileHash, rawRows, ...skipped.summary() };
};

module.exports = { parseDeliveryOrderExcel };
