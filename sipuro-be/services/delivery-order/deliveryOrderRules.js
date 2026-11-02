'use strict';

/**
 * Aturan bersama modul Delivery Order. Satu-satunya tempat yang mendefinisikan jenis transaksi
 * file, kolom Excel yang dibaca, alasan penolakan baris, dan kunci (item, lot).
 *
 * KONTRAK DATA (tanpa hubungan ke PO, karena pengiriman fisik terikat ke lot, bukan ke PO):
 *  - delivery_order_lots : satu baris per (DO, item PO, lot) per upload (qty_pcs, qty_ctn, tanggal dan jam).
 *  - delivery_returns    : satu baris per (nomor retur, item PO, lot) per upload.
 *  - Batas kirim per (item PO, lot)  = jumlah allocated_qty alokasi non-Canceled item itu pada lot tersebut
 *                                      dikurangi total yang sudah dikirim lewat DO.
 *  - Batas retur per (item PO, lot)  = total terkirim dikurangi total yang sudah diretur.
 *  - Retur tidak mengubah nilai DO dan tidak membuka kuota kirim lagi.
 */

const TRANS_TYPE = Object.freeze({
    ISSUE: 'Sales order issue',
    RETURN: 'RMA Receipt'
});

// Indeks kolom Excel (0 = kolom A)
const COLUMN = Object.freeze({
    TRANS_TYPE: 1,  // B
    STATUS: 2,      // C
    TRANS_DATE: 3,  // D
    ITEM: 4,        // E
    LOT: 11,        // L
    QTY_IN: 16,     // Q  (RMA Receipt)
    QTY_OUT: 19,    // T  (Sales order issue)
    REFERENCE: 25   // Z  (nomor DO untuk Sales order issue, nomor retur untuk RMA Receipt)
});

const REASONS = Object.freeze({
    MISSING_DO_NUMBER: 'Missing DO number (Shipment Num.)',
    MISSING_RETURN_NUMBER: 'Missing return number (Shipment Num.)',
    MISSING_LOT: 'Missing lot number',
    MISSING_DATE: 'Missing or invalid transaction date',
    NON_POSITIVE_QTY: 'Quantity must be greater than zero',
    LOT_NOT_FOUND: 'Lot number not found',
    NO_ALLOCATION: 'No PO allocation for this item and lot',
    EXCEEDS_ALLOCATION: 'Exceeds allocated quantity',
    NO_DELIVERY: 'No delivered quantity for this item and lot',
    EXCEEDS_DELIVERED: 'Return exceeds delivered quantity'
});

// Kunci pasangan (kode item PO, nomor lot)
const stockKey = (itemCode, lotNumber) => `${itemCode}\u0000${lotNumber}`;

module.exports = { TRANS_TYPE, COLUMN, REASONS, stockKey };
