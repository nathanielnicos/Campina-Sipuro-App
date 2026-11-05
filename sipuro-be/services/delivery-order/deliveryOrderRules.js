'use strict';

/**
 * Aturan bersama modul Delivery Order. Satu-satunya tempat yang mendefinisikan jenis transaksi
 * file, kolom Excel yang dibaca, alasan penolakan baris, dan kunci (item, lot).
 *
 * KONTRAK DATA (tanpa hubungan ke PO, karena pengiriman fisik terikat ke lot, bukan ke PO):
 *  - Kode item di file DO = kode produk hasil PRODUKSI (produk lot), bisa berbeda dari kode produk di PO
 *    bila ada pemetaan kode produk (kode lama -> baru). Satu lot bisa dialokasikan ke beberapa PO.
 *  - delivery_order_lots : satu baris per (DO, item, lot) per upload (qty_pcs, qty_ctn, tanggal dan jam).
 *  - delivery_returns    : satu baris per (nomor retur, item, lot) per upload.
 *  - Batas kirim per (item, lot)     = jumlah allocated_qty alokasi non-Canceled lot tersebut ke PO mana pun
 *                                      (produk ditentukan oleh lots.id_product) dikurangi TERKIRIM BERSIH
 *                                      (total terkirim dikurangi total retur): retur membuka kuota kirim lagi.
 *  - Batas retur per (item, lot)     = total terkirim dikurangi total yang sudah diretur.
 *  - Retur tidak mengubah nilai DO yang sudah tercatat.
 */

const { QTY_COLUMN } = require('../upload-trans-type/uploadTransTypeRules');

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
    QTY_IN: QTY_COLUMN.IN,   // Q  (RMA Receipt)
    QTY_OUT: QTY_COLUMN.OUT, // T  (Sales order issue)
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

// Kunci pasangan (kode produk lot, nomor lot)
const stockKey = (itemCode, lotNumber) => `${itemCode}\u0000${lotNumber}`;

module.exports = { TRANS_TYPE, COLUMN, REASONS, stockKey };
