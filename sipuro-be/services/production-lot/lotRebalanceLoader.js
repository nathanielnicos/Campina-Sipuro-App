'use strict';

/**
 * Memuat data yang dibutuhkan penyusunan ulang alokasi (rebalance) satu produk beserta keluarga kodenya.
 * Dipakai pratinjau (tanpa lock) dan commit (forUpdate di dalam transaksi ber-lock): bentuk data sama.
 */

const { chunk } = require('../../helpers/arrayUtils');
const { BusinessError } = require('../../helpers/businessError');
const { buildFamilyIndex } = require('../product-code-mapping/productFamilies');
const { fetchLotStock } = require('../delivery-order/deliveryOrderTotals');
const { buildStockCodeResolver } = require('../product-code-mapping/stockFamilyKey');
const { fetchPoDetails } = require('./lotContextLoader');
const { ELIGIBLE_DETAIL_STATUSES, lotBatchKey } = require('./lotAllocationRules');
const { NOT_DELETED_SQL } = require('../../helpers/po/openItemRules');
const { MANUAL_ADJUSTMENT_TYPE, REVERSAL_TYPE } = require('./lotRebalanceTypes');

const COLLATE = 'COLLATE utf8mb4_unicode_ci';
const SIGNED_QTY = "CASE WHEN t.direction = 'OUT' THEN -d.qty_pac ELSE d.qty_pac END";
const TYPE_JOIN = `LEFT JOIN upload_trans_types t
      ON t.scope = 'LOT' AND t.trans_type ${COLLATE} = d.trans_type ${COLLATE}`;
const LOT_JOIN = `JOIN products p ON p.product_code ${COLLATE} = d.item_code ${COLLATE}
    JOIN lots l ON l.lot_number ${COLLATE} = d.lot_number ${COLLATE} AND l.id_product = p.id_product`;

const loadRebalanceInput = async (queryable, productId, { forUpdate = false } = {}) => {
    const lock = forUpdate ? ' FOR UPDATE' : '';

    const [allProducts] = await queryable.query(
        'SELECT id_product, product_code, product_name, is_active FROM products'
    );
    if (!allProducts.some((p) => Number(p.id_product) === Number(productId))) {
        throw new BusinessError('Product not found.', 404);
    }
    const [productMappings] = await queryable.query(
        'SELECT id_product_old, id_product_new FROM product_code_mappings WHERE is_active = 1'
    );
    const familyIds = buildFamilyIndex(productMappings).familyOf(productId).map(Number);

    const [lots] = await queryable.query(
        'SELECT id, lot_number, id_product, actual_completed_datetime, expired_date FROM lots WHERE id_product IN (?) ORDER BY id',
        [familyIds]
    );
    const lotIds = lots.map((l) => l.id);

    // Kunci berurutan item PO (urutan sama dengan commit upload), lalu baca
    if (forUpdate) {
        await queryable.query(
            `SELECT d.po_detail_id FROM po_details d
             WHERE d.id_product IN (?) AND ${NOT_DELETED_SQL} AND d.status IN (?)
             ORDER BY d.po_detail_id FOR UPDATE`,
            [familyIds, ELIGIBLE_DETAIL_STATUSES]
        );
    }

    const allocations = [];
    for (const part of chunk(lotIds, 500)) {
        const [rows] = await queryable.query(
            `SELECT id, po_detail_id, lot_id, id_batch, allocated_qty, status
             FROM po_lot_allocations WHERE lot_id IN (?) ORDER BY id${lock}`,
            [part]
        );
        allocations.push(...rows);
    }

    const batchIds = [...new Set(allocations.map((a) => a.id_batch))].sort((a, b) => a - b);
    const batches = [];
    for (const part of chunk(batchIds, 500)) {
        const [rows] = await queryable.query('SELECT id, batch_number, id_product FROM batches WHERE id IN (?)', [part]);
        batches.push(...rows);
    }

    const openPoDetails = await fetchPoDetails(queryable, 'd.id_product IN (?)', [familyIds]);
    const loaded = new Set(openPoDetails.map((po) => po.po_detail_id));
    const extraIds = [...new Set(allocations.map((a) => a.po_detail_id))].filter((id) => !loaded.has(id)).sort((a, b) => a - b);
    for (const part of chunk(extraIds, 500)) {
        openPoDetails.push(...await fetchPoDetails(queryable, 'd.po_detail_id IN (?)', [part]));
    }

    // Produksi bersih per (lot, batch) dan per lot, serta tanggal selesai pertama per (lot, batch)
    const netByLotBatch = new Map();
    const netByLot = new Map();
    const firstCompleted = new Map();
    if (lotIds.length > 0) {
        const [pairRows] = await queryable.query(
            `SELECT l.id AS lot_id, b.id AS batch_id, SUM(${SIGNED_QTY}) AS net_qty,
                    DATE_FORMAT(MIN(d.actual_completed_datetime), '%Y-%m-%d %H:%i:%s') AS first_completed
             FROM production_lot_upload_details d
             ${LOT_JOIN}
             JOIN batches b ON b.batch_number ${COLLATE} = d.batch_number ${COLLATE}
             ${TYPE_JOIN}
             WHERE l.id IN (?) AND d.batch_number <> ''
             GROUP BY l.id, b.id`,
            [lotIds]
        );
        pairRows.forEach((r) => {
            const key = lotBatchKey(r.lot_id, r.batch_id);
            netByLotBatch.set(key, Number(r.net_qty) || 0);
            if (r.first_completed) firstCompleted.set(key, r.first_completed);
        });
        const [lotRows] = await queryable.query(
            `SELECT l.id AS lot_id, SUM(${SIGNED_QTY}) AS net_qty
             FROM production_lot_upload_details d
             ${LOT_JOIN}
             ${TYPE_JOIN}
             WHERE l.id IN (?)
             GROUP BY l.id`,
            [lotIds]
        );
        lotRows.forEach((r) => netByLot.set(r.lot_id, Number(r.net_qty) || 0));
    }

    // Perubahan qty manual bersih per alokasi: edit manual ditambah pembatalannya. Riwayat lama (sebelum kolom
    // jenis transaksi ada) dikenali dari: bukan dari upload, jenis kosong, dan qty berubah.
    const manualDeltas = new Map();
    const allocationIds = allocations.map((a) => a.id);
    for (const part of chunk(allocationIds, 500)) {
        const [rows] = await queryable.query(
            `SELECT allocation_id, SUM(new_allocated_qty - old_allocated_qty) AS delta
             FROM po_lot_allocation_logs
             WHERE allocation_id IN (?) AND action_type = 'UPDATE'
               AND (trans_type IN (?, ?)
                    OR (trans_type IS NULL AND upload_log_id IS NULL AND new_allocated_qty <> old_allocated_qty))
             GROUP BY allocation_id`,
            [part, MANUAL_ADJUSTMENT_TYPE, REVERSAL_TYPE]
        );
        rows.forEach((r) => {
            const delta = Number(r.delta) || 0;
            if (delta !== 0) manualDeltas.set(r.allocation_id, delta);
        });
    }

    const stockCodes = buildStockCodeResolver(allProducts, productMappings);
    // Terkirim bersih (terkirim - retur): retur membuka kuota kirim lagi
    const { netDelivered: lotDelivered } = await fetchLotStock(queryable, lots.map((l) => l.lot_number), { stockCodes });

    return {
        productId: Number(productId),
        allocations, lots, batches, openPoDetails, allProducts, productMappings,
        manualDeltas, netByLotBatch, netByLot, firstCompleted, lotDelivered, stockCodes
    };
};

module.exports = { loadRebalanceInput };
