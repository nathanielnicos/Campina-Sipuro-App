'use strict';

/**
 * Definisi tunggal "item PO yang masih berjalan" untuk semua modul yang membaca po_details
 * (Outstanding PO, PO Requirement di Production Schedule). Query yang memakai alias
 * d = po_details dan h = po_headers boleh memakai potongan SQL di sini; jangan menulis ulang aturannya.
 *
 * KONTRAK DATA: qty yang sudah terpenuhi diambil dari po_details.fulfilled_qty (boleh NULL, dianggap 0).
 * Setiap modul alokasi (batch sekarang, lot nanti) wajib menjaga kolom itu tetap sinkron.
 */

// Baris detail yang belum dihapus.
const NOT_DELETED_SQL = 'd.deleted_at IS NULL';

// Hanya PO yang sudah disetujui PPIC.
const APPROVED_HEADER_SQL = `h.status = 'Approved'`;

// Item yang masih berjalan dan belum terpenuhi penuh. Item Closed / Partially Closed bukan kebutuhan lagi.
const OPEN_ITEM_SQL = `d.status IN ('Active', 'Close Requested') AND IFNULL(d.fulfilled_qty, 0) < d.base_qty`;

// Item yang sudah di-close (tetap ditampilkan di Outstanding PO agar sama dengan PO aslinya).
const CLOSED_ITEM_SQL = `d.status IN ('Closed', 'Partially Closed')`;

// Sisa hanya dihitung untuk item yang masih berjalan; item Closed/Partially Closed sisanya sudah dilepas.
const REMAINING_SQL = `CASE WHEN d.status IN ('Active', 'Close Requested')
        THEN GREATEST(0, d.base_qty - IFNULL(d.fulfilled_qty, 0)) ELSE 0 END`;

module.exports = {
    NOT_DELETED_SQL,
    APPROVED_HEADER_SQL,
    OPEN_ITEM_SQL,
    CLOSED_ITEM_SQL,
    REMAINING_SQL
};
