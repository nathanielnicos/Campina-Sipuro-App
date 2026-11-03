'use strict';

/**
 * Kapasitas alokasi sebuah pasangan (lot, batch): produksi bersih dikurangi alokasi PO lain.
 * Produksi bersih = completion dikurangi return dari baris upload yang tersimpan
 * (production_lot_upload_details). qty_pac tersimpan positif; jenis transaksi menentukan tandanya.
 * Produk yang dipakai adalah produk LOT (bukan produk PO): alokasi lewat pemetaan kode produk boleh
 * berasal dari lot berkode lain.
 */

const { ALLOCATION_STATUS } = require('./lotAllocationRules');

// COLLATE: kolom di tabel upload memakai collation berbeda dari lots/batches/products.
// Arah jenis transaksi (tabel upload_trans_types, scope LOT) menentukan tanda: OUT (retur, issue sampel,
// WIP issue) mengurangi produksi bersih. Dibaca dari seluruh jenis, aktif maupun tidak, supaya data lama
// tetap dihitung sama. Per (batch, lot, item): baris jenis berbasis lot tersimpan dengan batch kosong, jadi tidak ikut.
const NET_QTY_SELECT = `SELECT COALESCE(SUM(CASE WHEN t.direction = 'OUT' THEN -d.qty_pac ELSE d.qty_pac END), 0) AS net_qty
    FROM production_lot_upload_details d
    LEFT JOIN upload_trans_types t
      ON t.scope = 'LOT' AND t.trans_type COLLATE utf8mb4_unicode_ci = d.trans_type COLLATE utf8mb4_unicode_ci`;

const NET_PRODUCED_BY_BATCH_SQL = `${NET_QTY_SELECT}
    WHERE d.batch_number COLLATE utf8mb4_unicode_ci = ?
      AND d.lot_number COLLATE utf8mb4_unicode_ci = ?
      AND d.item_code COLLATE utf8mb4_unicode_ci = ?`;

// Per (lot, item) tanpa batch: seluruh batch lot itu dikurangi seluruh issue pada lot itu.
const NET_PRODUCED_BY_LOT_SQL = `${NET_QTY_SELECT}
    WHERE d.lot_number COLLATE utf8mb4_unicode_ci = ?
      AND d.item_code COLLATE utf8mb4_unicode_ci = ?`;

const getNetProducedQty = async (connection, { batchNumber, lotNumber, itemCode }) => {
    const [[row]] = await connection.query(NET_PRODUCED_BY_BATCH_SQL, [batchNumber, lotNumber, itemCode]);
    return Number(row && row.net_qty) || 0;
};

const getLotNetProducedQty = async (connection, { lotNumber, itemCode }) => {
    const [[row]] = await connection.query(NET_PRODUCED_BY_LOT_SQL, [lotNumber, itemCode]);
    return Number(row && row.net_qty) || 0;
};

/**
 * Dua batas berlaku bersamaan:
 *  - per batch: produksi bersih (lot, batch) dikurangi alokasi PO lain pada (lot, batch) itu,
 *  - per lot: produksi bersih lot (semua batch, dikurangi retur dan issue) dikurangi alokasi lain pada lot itu.
 * @returns {Promise<{ netProduced, otherAllocated, lotNetProduced, lotOtherAllocated, available, limitedBy }>}
 *   available = qty maksimum untuk alokasi yang sedang diedit (tidak pernah negatif);
 *   limitedBy = 'LOT' bila batas lot yang lebih ketat, selain itu 'BATCH'
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
    if (!names) return { netProduced: 0, otherAllocated: 0, lotNetProduced: 0, lotOtherAllocated: 0, available: 0, limitedBy: 'BATCH' };

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

    const lotNetProduced = await getLotNetProducedQty(connection, {
        lotNumber: names.lot_number,
        itemCode: names.product_code
    });
    const [[lotOthers]] = await connection.query(
        `SELECT COALESCE(SUM(allocated_qty), 0) AS total
         FROM po_lot_allocations
         WHERE lot_id = ? AND id <> ? AND status <> ?`,
        [lotId, excludeAllocationId, ALLOCATION_STATUS.CANCELED]
    );
    const lotOtherAllocated = Number(lotOthers && lotOthers.total) || 0;

    const batchAvailable = Math.max(0, netProduced - otherAllocated);
    const lotAvailable = Math.max(0, lotNetProduced - lotOtherAllocated);
    return {
        netProduced,
        otherAllocated,
        lotNetProduced,
        lotOtherAllocated,
        available: Math.min(batchAvailable, lotAvailable),
        limitedBy: lotAvailable < batchAvailable ? 'LOT' : 'BATCH'
    };
};

module.exports = { getNetProducedQty, getLotNetProducedQty, getLotBatchCapacity };
