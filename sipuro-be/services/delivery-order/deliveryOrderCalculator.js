'use strict';

/**
 * Kalkulator upload Delivery Order dan retur (fungsi murni, tanpa akses database).
 * Dipakai SAMA PERSIS oleh preview dan commit, sehingga hasil preview identik dengan yang disimpan.
 *
 * Aturan:
 *  - Kode item di file = kode produk hasil produksi (produk lot), bisa berbeda dari kode di PO (pemetaan kode).
 *    Pengiriman terikat ke lot, bukan ke PO.
 *  - Baris dikelompokkan per (nomor DO, item, lot). Total grup harus muat PENUH dalam sisa kuota
 *    (item, lot) = total alokasi non-Canceled dikurangi yang sudah dikirim; kalau tidak, seluruh baris
 *    grup menjadi Unallocated. Force Closed ikut dihitung karena qty-nya sudah terpenuhi.
 *  - Urutan grup tetap: tanggal dan jam paling awal, nomor DO, item, lot, lalu urutan di file.
 *  - Retur (RMA Receipt) diproses SETELAH seluruh DO, dikelompokkan per (nomor retur, item, lot),
 *    dan tidak boleh melebihi total terkirim (termasuk DO dalam file yang sama) dikurangi retur sebelumnya.
 *    Retur tidak mengubah nilai DO.
 *  - Hanya baris dari grup yang diterima yang masuk newRows (disimpan sebagai "sudah diproses").
 *    Baris yang ditolak tidak disimpan, sehingga bisa diproses di file berikutnya.
 */

const crypto = require('crypto');
const { BusinessError } = require('../../helpers/businessError');
const { TRANS_TYPE, REASONS, stockKey } = require('./deliveryOrderRules');

const cmp = (a, b) => (a === b ? 0 : (a < b ? -1 : 1));

const toCtn = (qtyPcs, pcsPerCtn) => {
    const perCtn = Number(pcsPerCtn) || 0;
    return perCtn > 0 ? Math.round((qtyPcs / perCtn) * 100) / 100 : 0;
};

const groupKeyOf = (row) => `${row.referenceNum}\u0000${row.itemCode}\u0000${row.lotNumber}`;

const emptyStock = () => ({
    lotsFound: new Set(),
    allocated: new Map(),
    delivered: new Map(),
    returned: new Map()
});

const calculateDeliveryOrders = (
    rawRows = [],
    existingHashes = [],
    allProducts = [],
    stockInput = {}
) => {
    const stock = { ...emptyStock(), ...stockInput };
    const hashSet = new Set(existingHashes);
    const productByCode = new Map(allProducts.map((p) => [p.product_code, p]));

    const categorizedDetails = {
        newRows: [],
        unallocatedRows: [],
        duplicateRows: [],
        nonGoodRows: [],
        unregisteredRows: []
    };

    const issueGroups = new Map();
    const returnGroups = new Map();
    const invalidQtyRows = [];

    const reject = (row, reason) => {
        row.rowStatusCategory = 'UNALLOCATED';
        categorizedDetails.unallocatedRows.push({ ...row, reason });
    };

    // 1. Kategorisasi baris
    rawRows.forEach((row, index) => {
        const isRegistered = productByCode.has(row.itemCode);
        if (isRegistered && row.qtyIsWhole === false) {
            invalidQtyRows.push(`${row.excelRowNumber} ("${row.rawQtyText}")`);
        }
        const isReturn = row.transType === TRANS_TYPE.RETURN;

        if (!isRegistered) {
            row.rowStatusCategory = 'UNREGISTERED';
            categorizedDetails.unregisteredRows.push(row);
        } else if (hashSet.has(row.rowHash)) {
            row.rowStatusCategory = 'DUPLICATE';
            categorizedDetails.duplicateRows.push(row);
        } else if (!row.lotStatus || row.lotStatus.toUpperCase() !== 'GOOD') {
            row.rowStatusCategory = 'NON_GOOD';
            categorizedDetails.nonGoodRows.push(row);
        } else if (!row.referenceNum) {
            reject(row, isReturn ? REASONS.MISSING_RETURN_NUMBER : REASONS.MISSING_DO_NUMBER);
        } else if (!row.lotNumber) {
            reject(row, REASONS.MISSING_LOT);
        } else if (!row.transDateTime) {
            reject(row, REASONS.MISSING_DATE);
        } else if (!(Number(row.qty) > 0)) {
            reject(row, REASONS.NON_POSITIVE_QTY);
        } else {
            row.rowStatusCategory = 'NEW';
            const groups = isReturn ? returnGroups : issueGroups;
            const key = groupKeyOf(row);
            let group = groups.get(key);
            if (!group) {
                group = {
                    referenceNum: row.referenceNum,
                    itemCode: row.itemCode,
                    lotNumber: row.lotNumber,
                    transDateTime: row.transDateTime,
                    totalQty: 0,
                    rows: [],
                    firstIndex: index
                };
                groups.set(key, group);
            }
            if (row.transDateTime < group.transDateTime) group.transDateTime = row.transDateTime;
            group.totalQty += Number(row.qty);
            group.rows.push(row);
        }
    });

    if (invalidQtyRows.length > 0) {
        const shown = invalidQtyRows.slice(0, 20).join(', ');
        const more = invalidQtyRows.length > 20 ? ` and ${invalidQtyRows.length - 20} more` : '';
        throw new BusinessError(`Quantity must be a whole number. Please fix Excel row(s): ${shown}${more}.`, 422);
    }

    const byOrder = (a, b) => cmp(a.transDateTime, b.transDateTime)
        || cmp(a.referenceNum, b.referenceNum)
        || cmp(a.itemCode, b.itemCode)
        || cmp(a.lotNumber, b.lotNumber)
        || (a.firstIndex - b.firstIndex);

    const acceptedRows = [];
    const doLines = [];
    const returnLines = [];

    const rejectGroup = (group, reason) => group.rows.forEach((row) => reject(row, reason));
    const accept = (group, target) => {
        const product = productByCode.get(group.itemCode);
        target.push({
            referenceNum: group.referenceNum,
            productId: product.id_product,
            itemCode: group.itemCode,
            productName: product.product_name,
            lotNumber: group.lotNumber,
            qtyPcs: group.totalQty,
            qtyCtn: toCtn(group.totalQty, product.pcs_per_ctn),
            transDateTime: group.transDateTime,
            rowCount: group.rows.length
        });
        group.rows.forEach((row) => {
            row.rowStatusCategory = 'NEW';
            acceptedRows.push(row);
        });
    };

    const deliveredInFile = new Map();
    const returnedInFile = new Map();
    const sumOf = (map, key) => Number(map.get(key)) || 0;

    // 2. Pengiriman (DO)
    [...issueGroups.values()].sort(byOrder).forEach((group) => {
        const key = stockKey(group.itemCode, group.lotNumber);
        const allocated = sumOf(stock.allocated, key);

        if (!stock.lotsFound.has(group.lotNumber)) {
            return rejectGroup(group, REASONS.LOT_NOT_FOUND);
        }
        if (allocated <= 0) {
            return rejectGroup(group, REASONS.NO_ALLOCATION);
        }
        const available = allocated - sumOf(stock.delivered, key) - sumOf(deliveredInFile, key);
        if (available < group.totalQty) {
            return rejectGroup(group, `${REASONS.EXCEEDS_ALLOCATION} (Available: ${Math.max(0, available)}, Required: ${group.totalQty})`);
        }
        deliveredInFile.set(key, sumOf(deliveredInFile, key) + group.totalQty);
        accept(group, doLines);
    });

    // 3. Retur (RMA): terhadap total terkirim, termasuk DO yang baru diterima dari file ini
    [...returnGroups.values()].sort(byOrder).forEach((group) => {
        const key = stockKey(group.itemCode, group.lotNumber);

        if (!stock.lotsFound.has(group.lotNumber)) {
            return rejectGroup(group, REASONS.LOT_NOT_FOUND);
        }
        const delivered = sumOf(stock.delivered, key) + sumOf(deliveredInFile, key);
        if (delivered <= 0) {
            return rejectGroup(group, REASONS.NO_DELIVERY);
        }
        const available = delivered - sumOf(stock.returned, key) - sumOf(returnedInFile, key);
        if (available < group.totalQty) {
            return rejectGroup(group, `${REASONS.EXCEEDS_DELIVERED} (Returnable: ${Math.max(0, available)}, Required: ${group.totalQty})`);
        }
        returnedInFile.set(key, sumOf(returnedInFile, key) + group.totalQty);
        accept(group, returnLines);
    });

    // Baris tersimpan mengikuti urutan kemunculan di file
    const acceptedSet = new Set(acceptedRows);
    categorizedDetails.newRows = rawRows.filter((row) => acceptedSet.has(row));

    // Baris ditolak ditampilkan mengikuti urutan baris Excel
    categorizedDetails.unallocatedRows.sort((a, b) => a.excelRowNumber - b.excelRowNumber);

    const issueRowCount = categorizedDetails.newRows.filter((r) => r.transType === TRANS_TYPE.ISSUE).length;

    return {
        categorizedDetails,
        doLines,
        returnLines,
        canSave: doLines.length > 0 || returnLines.length > 0,
        summary: {
            totalRows: rawRows.length,
            validDoRows: issueRowCount,
            validReturnRows: categorizedDetails.newRows.length - issueRowCount,
            doLineCount: doLines.length,
            returnLineCount: returnLines.length,
            unallocatedRows: categorizedDetails.unallocatedRows.length,
            duplicateRows: categorizedDetails.duplicateRows.length,
            nonGoodRows: categorizedDetails.nonGoodRows.length,
            unregisteredRows: categorizedDetails.unregisteredRows.length
        }
    };
};

// Sidik jari hasil hitung: dikirim ke klien saat preview, dicocokkan ulang saat commit
const computeDeliveryFingerprint = (calculation) => {
    const line = (l) => [l.referenceNum, l.itemCode, l.lotNumber, l.qtyPcs, l.transDateTime];
    const payload = {
        rows: calculation.categorizedDetails.newRows.map((r) => r.rowHash),
        doLines: calculation.doLines.map(line),
        returnLines: calculation.returnLines.map(line)
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

module.exports = { calculateDeliveryOrders, computeDeliveryFingerprint };
