'use strict';

/**
 * Tampilan Ready to Ship: daftar lot yang masih punya sisa dan sebaiknya dikirim duluan (satu baris per lot).
 *
 * Aturan:
 *  - Sisa = produksi bersih lot (upload: IN - OUT, semua status, ditambah lots.adjusted_qty) - terkirim bersih
 *    (DO - retur), sama dengan kolom Sisa di tampilan Lot Number. Hanya lot dengan Sisa > 0.
 *  - Lot tanpa alokasi PO (selain Canceled) disembunyikan (mis. lot rework yang secara fisik sudah habis).
 *    Status alokasi (Open / Closed / ...) tidak dipakai: tidak mempengaruhi DO.
 *  - Urutan: tanggal selesai produksi terlama dulu; tanpa tanggal selesai di paling akhir; lalu nomor lot.
 *  - fifo_rank = urutan FIFO di dalam produk yang sama, dihitung dari SEMUA lot siap kirim (tidak terpengaruh pencarian).
 *  - rank = urutan global pada hasil yang tampil (menyambung antar halaman).
 * Hanya membaca data.
 */

const num = (value) => Number(value) || 0;

const COLLATE = 'COLLATE utf8mb4_unicode_ci';

// Qty lot = produksi bersih dari upload + penyesuaian manual (lots.adjusted_qty)
const LOT_QTY_SQL = 'COALESCE(pr.net_all, 0) + l.adjusted_qty';

// Semua lot siap kirim beserta fifo_rank; pencarian dipasang di luar (alias x) agar fifo_rank tetap utuh
const READY_BASE_SQL = `SELECT l.id AS lot_id, l.lot_number, p.id_product, p.product_code, p.product_name, p.pcs_per_ctn,
        l.actual_completed_datetime, l.expired_date,
        ${LOT_QTY_SQL} AS qty_lot,
        COALESCE(dd.kirim, 0) - COALESCE(rt.retur, 0) AS net_delivered,
        ${LOT_QTY_SQL} - (COALESCE(dd.kirim, 0) - COALESCE(rt.retur, 0)) AS balance_pcs,
        ROW_NUMBER() OVER (
            PARTITION BY l.id_product
            ORDER BY (l.actual_completed_datetime IS NULL), l.actual_completed_datetime, l.lot_number, l.id
        ) AS fifo_rank
    FROM lots l
    JOIN products p ON p.id_product = l.id_product
    LEFT JOIN (
        SELECT u.lot_number, u.item_code,
               SUM(CASE t.direction WHEN 'IN' THEN u.qty_pac ELSE -u.qty_pac END) AS net_all
        FROM production_lot_upload_details u
        JOIN (SELECT trans_type, MIN(direction) AS direction FROM upload_trans_types
              WHERE scope = 'LOT' AND is_active = 1 GROUP BY trans_type) t
          ON t.trans_type ${COLLATE} = u.trans_type ${COLLATE}
        GROUP BY u.lot_number, u.item_code
    ) pr ON pr.lot_number ${COLLATE} = l.lot_number ${COLLATE} AND pr.item_code ${COLLATE} = p.product_code ${COLLATE}
    JOIN (
        SELECT lot_id, SUM(allocated_qty) AS allocated
        FROM po_lot_allocations WHERE status <> 'Canceled' GROUP BY lot_id
    ) al ON al.lot_id = l.id AND al.allocated > 0
    LEFT JOIN (
        SELECT lot_number, product_id, SUM(qty_pcs) AS kirim FROM delivery_order_lots GROUP BY lot_number, product_id
    ) dd ON dd.lot_number ${COLLATE} = l.lot_number ${COLLATE} AND dd.product_id = l.id_product
    LEFT JOIN (
        SELECT lot_number, product_id, SUM(qty_pcs) AS retur FROM delivery_returns GROUP BY lot_number, product_id
    ) rt ON rt.lot_number ${COLLATE} = l.lot_number ${COLLATE} AND rt.product_id = l.id_product
    WHERE ${LOT_QTY_SQL} - (COALESCE(dd.kirim, 0) - COALESCE(rt.retur, 0)) > 0`;

const round2 = (value) => Math.round(value * 100) / 100;
const ctnOf = (pcs, pcsPerCtn) => (num(pcsPerCtn) > 0 ? round2(pcs / num(pcsPerCtn)) : 0);

/**
 * @param {Array} rows   hasil query (urut tampil)
 * @param {number} offset posisi awal halaman, untuk urutan global
 */
const shapeReadyToShip = (rows, offset = 0) => rows.map((row, idx) => ({
    rank: offset + idx + 1,
    fifo_rank: num(row.fifo_rank),
    lot_id: row.lot_id,
    lot_number: row.lot_number,
    id_product: row.id_product,
    product_code: row.product_code,
    product_name: row.product_name,
    actual_completed_datetime: row.actual_completed_datetime || null,
    expired_date: row.expired_date || null,
    qty_lot: num(row.qty_lot),
    qty_lot_ctn: ctnOf(num(row.qty_lot), row.pcs_per_ctn),
    net_delivered_pcs: num(row.net_delivered),
    net_delivered_ctn: ctnOf(num(row.net_delivered), row.pcs_per_ctn),
    balance_pcs: num(row.balance_pcs),
    balance_ctn: ctnOf(num(row.balance_pcs), row.pcs_per_ctn)
}));

/**
 * @param {{ whereSql, params, limit, offset }} request hasil parseDeliveryOrderRequest (mode READY_TO_SHIP)
 * @returns {Promise<{ data: Array, totalItems: number }>}
 */
const fetchReadyToShipPage = async (queryable, request) => {
    const { whereSql, params, limit, offset } = request;

    const [[countRow]] = await queryable.query(
        `SELECT COUNT(*) AS total FROM (${READY_BASE_SQL}) x WHERE ${whereSql}`,
        params
    );
    const totalItems = num(countRow && countRow.total);
    if (totalItems === 0) return { data: [], totalItems };

    const [rows] = await queryable.query(
        `SELECT x.* FROM (${READY_BASE_SQL}) x WHERE ${whereSql}
         ORDER BY (x.actual_completed_datetime IS NULL), x.actual_completed_datetime ASC, x.lot_number ASC, x.lot_id ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return { data: shapeReadyToShip(rows, offset), totalItems };
};

module.exports = { fetchReadyToShipPage, shapeReadyToShip, READY_BASE_SQL };
