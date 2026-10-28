'use strict';

/**
 * Kapasitas alokasi sebuah pasangan (lot, batch): produksi bersih dikurangi alokasi PO lain.
 * Produksi bersih = completion dikurangi return dari baris upload yang tersimpan
 * (production_lot_upload_details). qty_pac tersimpan positif; jenis transaksi menentukan tandanya.
 * Produk yang dipakai adalah produk LOT (bukan produk PO): alokasi lewat pemetaan kode produk boleh
 * berasal dari lot berkode lain.
 */

const { ALLOCATION_STATUS, TRANS_TYPE } = require('./lotAllocationRules');

// COLLATE: kolom di tabel upload memakai collation berbeda dari lots/batches/products.
const NET_PRODUCED_SQL = `SELECT COALESCE(SUM(CASE WHEN trans_type = ? THEN -qty_pac ELSE qty_pac END), 0) AS net_qty
    FROM production_lot_upload_details
    WHERE batch_number COLLATE utf8mb4_unicode_ci = ?
      AND lot_number COLLATE utf8mb4_unicode_ci = ?
      AND item_code COLLATE utf8mb4_unicode_ci = ?`;

const getNetProducedQty = async (connection, { batchNumber, lotNumber, itemCode }) => {
    const [[row]] = await connection.query(NET_PRODUCED_SQL, [TRANS_TYPE.RETURN, batchNumber, lotNumber, itemCode]);
    return Number(row && row.net_qty) || 0;
};

/**
 * @returns {Promise<{ netProduced: number, otherAllocated: number, available: number }>}
 *   available = qty maksimum untuk alokasi yang sedang diedit (tidak pernah negatif)
 */
const getLotBatchCapacity = async (connection, { lotId, batchId, excludeAllocationId }) => {
    const [[names]] = await connection.query(
        `SELECT l.lot_number, b.batch_number, p.product_code
         FROM lots l
         JOIN products p ON p.id_product = l.id_product
         CROSS JOIN batches b
         WHERE l.id = ? AND b.id = ?`,
        [lotId, batchId]
    );
    if (!names) return { netProduced: 0, otherAllocated: 0, available: 0 };

    const netProduced = await getNetProducedQty(connection, {
        batchNumber: names.batch_number,
        lotNumber: names.lot_number,
        itemCode: names.product_code
    });

    const [[others]] = await connection.query(
        `SELECT COALESCE(SUM(allocated_qty), 0) AS total
         FROM po_lot_allocations
         WHERE lot_id = ? AND id_batch = ? AND id <> ? AND status <> ?`,
        [lotId, batchId, excludeAllocationId, ALLOCATION_STATUS.CANCELED]
    );
    const otherAllocated = Number(others && others.total) || 0;

    return { netProduced, otherAllocated, available: Math.max(0, netProduced - otherAllocated) };
};

module.exports = { getNetProducedQty, getLotBatchCapacity };
