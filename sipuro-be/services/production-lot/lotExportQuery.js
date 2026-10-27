'use strict';

/**
 * Data ekspor mapping Production Lot.
 * Dua kumpulan data dengan filter yang sama dengan daftar mapping:
 *  - allocations: satu baris per alokasi (item PO, lot, batch), hanya nilai tingkat alokasi;
 *  - poItems: satu baris per item PO yang punya alokasi (nilai tingkat PO ada di sini, sekali per item).
 * Tanggal dikirim sebagai teks murni dari SQL (tanpa pergeseran zona waktu).
 */

const { BusinessError } = require('../../helpers/businessError');
const { MAPPING_FROM_SQL } = require('./lotMappingFilters');
const { allocatedQtySql } = require('./lotAllocationRules');

// Batas baris ekspor. Respons fungsi Vercel dibatasi sekitar 4,5 MB, jadi file harus tetap kecil.
const MAX_EXPORT_ROWS = 20000;

const DATETIME_SQL = (column) => `DATE_FORMAT(${column}, '%Y-%m-%d %H:%i:%s')`;

const fetchExportData = async (db, { whereSql, params }) => {
    const [countRows] = await db.query(
        `SELECT COUNT(*) AS total ${MAPPING_FROM_SQL} WHERE ${whereSql}`,
        params
    );
    const total = Number(countRows[0]?.total || 0);
    if (total > MAX_EXPORT_ROWS) {
        throw new BusinessError(
            `Too many rows to export (${total}). The maximum is ${MAX_EXPORT_ROWS}. Please narrow the filters.`,
            400
        );
    }
    if (total === 0) return { allocations: [], poItems: [] };

    const [allocations] = await db.query(
        `SELECT
            p.product_code,
            p.product_name,
            h.po_number,
            ${DATETIME_SQL('h.created_at')} AS po_created_at,
            b.batch_number,
            l.lot_number,
            ${DATETIME_SQL('l.actual_completed_datetime')} AS lot_completed_at,
            DATE_FORMAT(l.expired_date, '%Y-%m-%d') AS lot_expired_date,
            pla.allocated_qty,
            pla.status AS allocation_status
         ${MAPPING_FROM_SQL}
         WHERE ${whereSql}
         ORDER BY h.created_at DESC, h.po_number ASC, p.product_code ASC, b.batch_number ASC, l.lot_number ASC, pla.id ASC`,
        params
    );

    const [poItems] = await db.query(
        `SELECT
            h.po_number,
            ${DATETIME_SQL('h.created_at')} AS po_created_at,
            p.product_code,
            p.product_name,
            d.base_qty,
            ${allocatedQtySql('d.po_detail_id')} AS total_allocated
         ${MAPPING_FROM_SQL}
         WHERE ${whereSql}
         GROUP BY d.po_detail_id, h.po_number, h.created_at, p.product_code, p.product_name, d.base_qty
         ORDER BY h.created_at DESC, h.po_number ASC, p.product_code ASC, d.po_detail_id ASC`,
        params
    );

    return { allocations, poItems };
};

module.exports = { MAX_EXPORT_ROWS, fetchExportData };
