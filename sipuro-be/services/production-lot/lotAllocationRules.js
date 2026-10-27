'use strict';

/**
 * Aturan bersama modul Production Lot. Satu-satunya tempat yang mendefinisikan:
 *  - status PO / alokasi yang boleh ikut proses alokasi lot,
 *  - rumus "qty teralokasi" sebuah item PO (SQL),
 *  - bentuk kunci alokasi (item PO, lot, batch), kunci (lot, batch), dan kunci lot.
 * Kalkulator, loader, commit, dan layanan status wajib memakai yang ada di sini.
 *
 * KONTRAK DATA: po_details.fulfilled_qty = jumlah allocated_qty dari po_lot_allocations
 * yang statusnya bukan 'Canceled' (lihat allocatedQtySql). Granularitas alokasi: (item PO, lot, batch). Hanya recalculateFulfilledQty
 * (lotStatusService) yang menulis kolom itu untuk alur lot.
 *
 * Catatan perbedaan dengan helpers/po/openItemRules.js (Outstanding PO / PO Requirement):
 * alokasi lot sengaja memuat header 'Production Completed' dan item yang sudah terpenuhi
 * penuh, supaya retur produksi masih bisa mengurangi alokasi yang sudah ada.
 */

const ALLOCATION_STATUS = Object.freeze({
    OPEN: 'Open',
    CLOSED: 'Closed',
    CANCELED: 'Canceled',
    FORCE_CLOSED: 'Force Closed'
});

const PO_DETAIL_STATUS = Object.freeze({
    ACTIVE: 'Active',
    CLOSE_REQUESTED: 'Close Requested'
});

// Jenis transaksi pada file produksi (disimpan apa adanya di production_lot_upload_details.trans_type)
const TRANS_TYPE = Object.freeze({
    COMPLETION: 'WIP Completion',
    RETURN: 'WIP Completion Return'
});

// Header PO yang boleh dialokasikan (dan yang statusnya boleh diubah otomatis oleh refreshPOStatus)
const ELIGIBLE_HEADER_STATUSES = Object.freeze(['Approved', 'Production Completed']);

// Item PO yang dimuat loader: 'Active' dialokasikan, 'Close Requested' memblokir proses upload
const ELIGIBLE_DETAIL_STATUSES = Object.freeze([PO_DETAIL_STATUS.ACTIVE, PO_DETAIL_STATUS.CLOSE_REQUESTED]);

// Alokasi yang masih boleh diubah oleh upload (Force Closed / Canceled tidak disentuh)
const ELIGIBLE_ALLOCATION_STATUSES = Object.freeze([ALLOCATION_STATUS.OPEN, ALLOCATION_STATUS.CLOSED]);

/**
 * Potongan SQL: total qty teralokasi sebuah item PO (alokasi Canceled tidak dihitung).
 * @param {string} detailRef kolom po_detail_id yang dikorelasikan, mis. 'd.po_detail_id'
 */
const allocatedQtySql = (detailRef) => `COALESCE((
        SELECT SUM(pla.allocated_qty)
        FROM po_lot_allocations pla
        WHERE pla.po_detail_id = ${detailRef} AND pla.status <> '${ALLOCATION_STATUS.CANCELED}'
    ), 0)`;

// Kunci alokasi: satu baris po_lot_allocations = (item PO, lot, batch)
const allocationKey = (poDetailId, lotId, batchId) => `${poDetailId}_${lotId}_${batchId}`;

// Kunci pasangan (lot, batch): batas jumlah produksi bersih dan retur berlaku per pasangan ini
const lotBatchKey = (lotId, batchId) => `${lotId}_${batchId}`;

// Kunci lot: nomor lot + produk (satu nomor lot bisa dipakai banyak produk)
const lotKey = (lotNumber, idProduct) => `${lotNumber}_${idProduct}`;

module.exports = {
    ALLOCATION_STATUS,
    PO_DETAIL_STATUS,
    TRANS_TYPE,
    ELIGIBLE_HEADER_STATUSES,
    ELIGIBLE_DETAIL_STATUSES,
    ELIGIBLE_ALLOCATION_STATUSES,
    allocatedQtySql,
    allocationKey,
    lotBatchKey,
    lotKey
};
