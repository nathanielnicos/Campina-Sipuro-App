'use strict';

/**
 * Data ekspor Delivery Order, dengan filter yang sama dengan daftar (pencarian dan rentang tanggal).
 * Tiga kumpulan data datar agar mudah dipivot:
 *  - deliveries : satu baris per (DO, item, lot), hanya nilai tingkat baris pengiriman;
 *  - returns    : satu baris per baris retur (nomor retur, item, lot);
 *  - lotBalance : satu baris per (keluarga produk, nomor lot) yang muncul di dua kumpulan di atas.
 *                 Nilai tingkat lot (teralokasi, terkirim, diretur, sisa kuota) hanya ada di sini dan dihitung dari
 *                 SELURUH data lot itu (bukan hanya rentang tanggal), memakai rumus bersama fetchLotStock.
 * Tanggal dikirim sebagai teks murni dari SQL (tanpa pergeseran zona waktu).
 */

const { BusinessError } = require('../../helpers/businessError');
const { chunk } = require('../../helpers/arrayUtils');
const { DO_FROM_SQL, RETURN_FROM_SQL } = require('./deliveryOrderFilters');
const { fetchLotStock, loadStockCodes } = require('./deliveryOrderTotals');
const { stockKey } = require('./deliveryOrderRules');

// Batas baris ekspor (pengiriman + retur). Respons fungsi Vercel dibatasi sekitar 4,5 MB, jadi file harus tetap kecil.
const MAX_EXPORT_ROWS = 20000;

const DATETIME_SQL = (column) => `DATE_FORMAT(${column}, '%Y-%m-%d %H:%i:%s')`;

const DELIVERY_GROUP_SQL = 'GROUP BY d.id, d.do_number, p.id_product, p.product_code, p.product_name, dol.lot_number';

const countRows = async (db, deliveries, returns) => {
    const [[deliveryRow]] = await db.query(
        `SELECT COUNT(*) AS total FROM (SELECT 1 ${DO_FROM_SQL} WHERE ${deliveries.whereSql} ${DELIVERY_GROUP_SQL}) t`,
        deliveries.params
    );
    const [[returnRow]] = await db.query(
        `SELECT COUNT(*) AS total ${RETURN_FROM_SQL} WHERE ${returns.whereSql}`,
        returns.params
    );
    return Number(deliveryRow?.total || 0) + Number(returnRow?.total || 0);
};

// Saldo per (kode kanonik keluarga, lot) dari semua pasangan (kode produk, lot) pada baris ekspor
const buildLotBalance = async (db, deliveryRows, returnRows) => {
    const pairs = new Map();
    [...deliveryRows, ...returnRows].forEach((row) => {
        pairs.set(stockKey(row.product_code, row.lot_number), { code: row.product_code, lot: row.lot_number });
    });
    if (pairs.size === 0) return [];

    const stockCodes = await loadStockCodes(db);
    const keys = new Map();
    pairs.forEach(({ code, lot }) => {
        const canonical = stockCodes.forProductCode(code);
        keys.set(stockKey(canonical, lot), { code: canonical, lot });
    });

    const lotNumbers = [...new Set([...keys.values()].map((k) => k.lot))];
    const { allocated, delivered, returned } = await fetchLotStock(db, lotNumbers, { stockCodes });

    const names = new Map();
    const codes = [...new Set([...keys.values()].map((k) => k.code))];
    for (const part of chunk(codes, 500)) {
        const [rows] = await db.query('SELECT product_code, product_name FROM products WHERE product_code IN (?)', [part]);
        rows.forEach((r) => names.set(r.product_code, r.product_name));
    }

    return [...keys.entries()]
        .map(([key, { code, lot }]) => ({
            product_code: code,
            product_name: names.get(code) || null,
            lot_number: lot,
            allocated_qty: Number(allocated.get(key)) || 0,
            delivered_qty: Number(delivered.get(key)) || 0,
            returned_qty: Number(returned.get(key)) || 0
        }))
        .sort((a, b) => a.product_code.localeCompare(b.product_code) || a.lot_number.localeCompare(b.lot_number));
};

/**
 * @param {{ deliveries: {whereSql, params}, returns: {whereSql, params} }} filters hasil parseDeliveryOrderExportRequest
 */
const fetchExportData = async (db, { deliveries, returns }) => {
    const total = await countRows(db, deliveries, returns);
    if (total > MAX_EXPORT_ROWS) {
        throw new BusinessError(
            `Too many rows to export (${total}). The maximum is ${MAX_EXPORT_ROWS}. Please narrow the filters.`,
            400
        );
    }
    if (total === 0) return { deliveries: [], returns: [], lotBalance: [] };

    const [deliveryRows] = await db.query(
        `SELECT d.do_number,
            ${DATETIME_SQL('MIN(dol.do_datetime)')} AS do_datetime,
            p.product_code,
            p.product_name,
            dol.lot_number,
            (SELECT ${DATETIME_SQL('MIN(l.actual_completed_datetime)')} FROM lots l WHERE l.lot_number = dol.lot_number) AS lot_completed_at,
            (SELECT DATE_FORMAT(MIN(l.expired_date), '%Y-%m-%d') FROM lots l WHERE l.lot_number = dol.lot_number) AS lot_expired_date,
            SUM(dol.qty_pcs) AS qty_pcs,
            SUM(dol.qty_ctn) AS qty_ctn
         ${DO_FROM_SQL}
         WHERE ${deliveries.whereSql}
         ${DELIVERY_GROUP_SQL}
         ORDER BY MIN(dol.do_datetime) DESC, d.do_number DESC, p.product_code ASC, dol.lot_number ASC`,
        deliveries.params
    );

    const [returnRows] = await db.query(
        `SELECT r.return_number,
            ${DATETIME_SQL('r.return_datetime')} AS return_datetime,
            p.product_code,
            p.product_name,
            r.lot_number,
            r.qty_pcs,
            r.qty_ctn
         ${RETURN_FROM_SQL}
         WHERE ${returns.whereSql}
         ORDER BY r.return_datetime DESC, r.return_number DESC, p.product_code ASC, r.lot_number ASC, r.id ASC`,
        returns.params
    );

    const lotBalance = await buildLotBalance(db, deliveryRows, returnRows);

    return { deliveries: deliveryRows, returns: returnRows, lotBalance };
};

module.exports = { MAX_EXPORT_ROWS, fetchExportData };
