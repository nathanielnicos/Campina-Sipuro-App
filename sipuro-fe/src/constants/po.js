// Konstanta bersama untuk fitur Purchase Order.
// Nilai teks status harus sama persis dengan yang disimpan di database.

export const PO_STATUS = Object.freeze({
    DRAFT: 'Draft',
    WAITING: 'Waiting for Confirmation',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELED: 'Canceled',
    PRODUCTION_COMPLETED: 'Production Completed'
});

// Batas kuantitas per baris item (disepakati: 1 miliar)
export const MAX_ITEM_QTY = 1000000000;

// Batas panjang catatan PO dan alasan penolakan
export const PO_TEXT_MAX_LENGTH = 50;

// Jumlah baris item per halaman pada tabel produk di modal PO
export const PO_ITEMS_PAGE_SIZE = 10;
