const crypto = require('crypto');
const { BusinessError } = require('../../helpers/businessError');
const { MAX_UPLOAD_ROWS } = require('../../helpers/uploadConfig');
const { readUploadSheet, parseExcelDateTime, parseDateOnly, parseQuantity } = require('../../helpers/excelUploadReader');
const { MATCH_BY, DIRECTION } = require('../upload-trans-type/uploadTransTypeRules');
const { createSkippedRowTracker } = require('../upload-trans-type/uploadSkippedRows');

// Jenis wajib upload produksi (tidak bisa ditambah manual). Jenis lain, termasuk jenis milik upload DO, dilewati tanpa peringatan.
const PRODUCTION_TRANS_TYPES = ['WIP Completion', 'WIP Completion Return'];

/**
 * @param {Buffer} fileBuffer
 * @param {(rawText: string) => object|undefined} findRule pencari aturan jenis transaksi (scope LOT, lihat uploadTransTypeLoader)
 * @param {{ startRow: number, timestampCell: string, columns: object }} format format file upload (scope LOT, lihat uploadFormatLoader)
 */
const parseProductionExcel = (fileBuffer, findRule, format) => {
    const { fileHash, processTimestamp, rows } = readUploadSheet(fileBuffer, format);
    const col = format.columns;

    const rawRows = [];
    const skipped = createSkippedRowTracker(PRODUCTION_TRANS_TYPES);

    for (const { cells: row, excelRowNumber } of rows) {
        // Jenis transaksi dikenali lewat daftar aktif di database (tidak peka huruf besar/kecil)
        const rule = findRule(row[col.TRANS_TYPE]);
        if (!rule) {
            // Jenis wajib yang nonaktif/tidak terdaftar dilaporkan di preview; jenis lain dilewati tanpa peringatan
            skipped.add(row[col.TRANS_TYPE], excelRowNumber);
            continue;
        }

        const transType = rule.label;
        const status = row[col.STATUS] ? String(row[col.STATUS]).trim() : '';
        const transDateRaw = row[col.TRANS_DATE];
        const itemCode = row[col.ITEM] ? String(row[col.ITEM]).trim() : '';

        // Doc Source -> hapus awalan BATCH (case-insensitive).
        // Jenis berbasis lot tidak memakai batch: kolom G hanya disimpan sebagai referensi (docSource).
        let docSource = row[col.DOC_SOURCE] ? String(row[col.DOC_SOURCE]).trim() : '';
        if (docSource.toUpperCase().startsWith('BATCH')) {
            docSource = docSource.replace(/^BATCH/i, '').trim();
        }
        const matchBy = rule.matchBy;
        const batchNumber = matchBy === MATCH_BY.LOT ? '' : docSource;

        const lotNumber = row[col.LOT_NUMBER] ? String(row[col.LOT_NUMBER]).trim() : '';
        const expDateRaw = row[col.EXP_DATE];

        // Kolom qty ditentukan arah jenis: IN = kolom Qty In, OUT = kolom Qty Out (menurut format upload)
        const rawQty = row[rule.direction === DIRECTION.IN ? col.QTY_IN : col.QTY_OUT];
        const qtyResult = parseQuantity(rawQty);
        const storedQtyPac = Math.abs(qtyResult.value);

        const actualCompletedDatetime = parseExcelDateTime(transDateRaw);
        const expiredDate = parseDateOnly(expDateRaw);

        const hashFields = [
            batchNumber,
            lotNumber,
            itemCode,
            transType,
            storedQtyPac,
            actualCompletedDatetime || '',
            expiredDate || ''
        ];
        const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

        // Jenis berbasis lot: Doc Source ikut hash (dokumen berbeda = baris berbeda). Hash tanpa Doc Source
        // (rumus lama) tetap dihitung sebagai legacyRowHash agar baris lama yang sudah tersimpan tetap dikenali duplikat.
        // Jenis berbasis batch: rumus tidak berubah (nomor batch = Doc Source sudah masuk hash).
        const isLotType = matchBy === MATCH_BY.LOT;
        const legacyRowHash = sha256(hashFields.join('|'));
        const rowHash = isLotType ? sha256([...hashFields, docSource].join('|')) : legacyRowHash;

        rawRows.push({
            batchNumber,
            lotNumber,
            itemCode,
            lotStatus: status,
            transType,
            matchBy,
            // Jenis lot-item: Doc Source disimpan sebagai referensi dan ikut hash baris
            docSource: isLotType ? docSource : '',
            qtyPac: storedQtyPac,
            rawAllocationQty: rule.sign * storedQtyPac,
            actualCompletedDatetime,
            expiredDate,
            rowHash,
            ...(isLotType ? { legacyRowHash } : {}),
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
        rawRows,
        ...skipped.summary()
    };
};

module.exports = {
    parseQuantity,
    parseExcelDateTime,
    parseProductionExcel
};
