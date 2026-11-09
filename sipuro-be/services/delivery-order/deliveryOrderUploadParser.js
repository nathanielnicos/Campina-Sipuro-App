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
const { DIRECTION } = require('../upload-trans-type/uploadTransTypeRules');
const { createSkippedRowTracker } = require('../upload-trans-type/uploadSkippedRows');

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/**
 * @param {Buffer} fileBuffer
 * @param {(rawText: string) => object|undefined} findRule pencari aturan jenis transaksi (scope DO, lihat uploadTransTypeLoader)
 */
const parseDeliveryOrderExcel = (fileBuffer, findRule) => {
    const { fileHash, processTimestamp, rows } = readUploadSheet(fileBuffer);

    const rawRows = [];
    const skipped = createSkippedRowTracker();

    for (const { cells, excelRowNumber } of rows) {
        const rule = findRule(cells[COLUMN.TRANS_TYPE]);
        if (!rule) {
            // Dilaporkan di preview, bukan dibuang diam-diam
            skipped.add(cells[COLUMN.TRANS_TYPE], excelRowNumber);
            continue;
        }

        // Arah OUT = pengiriman (Sales order issue, Qty Out / T); IN = retur (RMA Receipt, Qty In / Q).
        // Nilai transType disimpan memakai nama baku di TRANS_TYPE. Tanda qty dipertahankan.
        const isIssue = rule.direction === DIRECTION.OUT;
        const transType = isIssue ? TRANS_TYPE.ISSUE : TRANS_TYPE.RETURN;
        const rawQty = cells[rule.qtyColumn];
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

    return { processTimestamp, fileHash, rawRows, ...skipped.summary() };
};

module.exports = { parseDeliveryOrderExcel };
