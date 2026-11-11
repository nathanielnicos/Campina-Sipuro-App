'use strict';

/**
 * Membaca dan memvalidasi parameter daftar Delivery Order (tanpa akses database).
 *
 * Tiga tampilan:
 *  BY_DO     : delivery_order_lots (alias dol) + delivery_orders (d) + products (p)
 *  BY_LOT    : lots (l) + products (p); lot tanpa DO / retur tetap tampil. DO dan retur hanya sebagai pencarian / rentang tanggal
 *  BY_RETURN : delivery_returns (r) + products (p)
 *  READY_TO_SHIP : lot yang masih punya sisa (lihat deliveryOrderReadyToShip.js); hanya pencarian, tanpa filter tanggal
 */

const { BusinessError } = require('../../helpers/businessError');
const { asText, parsePageParams, parseDateParam, escapeLike } = require('../../helpers/queryParams');

const DISPLAY_MODES = Object.freeze(['BY_DO', 'BY_LOT', 'BY_RETURN', 'READY_TO_SHIP']);
const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 10;

const DO_FROM_SQL = `FROM delivery_order_lots dol
    JOIN delivery_orders d ON dol.delivery_order_id = d.id
    JOIN products p ON dol.product_id = p.id_product`;

const RETURN_FROM_SQL = `FROM delivery_returns r
    JOIN products p ON r.product_id = p.id_product`;

// Daftar lot: seluruh lot beserta produknya (lot yang belum pernah dikirim juga tampil)
const LOT_FROM_SQL = `FROM lots l
    JOIN products p ON p.id_product = l.id_product`;

const orderOf = (sortOrder) => (asText(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC');

/**
 * @returns {{ whereSql: string, params: any[] }} kondisi untuk tampilan DO / lot (dol, d, p)
 */
const buildDoFilters = (query, from, to) => {
    const conditions = ['1 = 1'];
    const params = [];

    const search = asText(query.search);
    if (search) {
        const like = `%${escapeLike(search)}%`;
        conditions.push('(d.do_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR dol.lot_number LIKE ?)');
        params.push(like, like, like, like);
    }
    if (from) { conditions.push('dol.do_datetime >= ?'); params.push(`${from} 00:00:00`); }
    if (to) { conditions.push('dol.do_datetime <= ?'); params.push(`${to} 23:59:59`); }

    return { whereSql: conditions.join(' AND '), params };
};

// Kondisi untuk tampilan retur (r, p)
const buildReturnFilters = (query, from, to) => {
    const conditions = ['1 = 1'];
    const params = [];

    const search = asText(query.search);
    if (search) {
        const like = `%${escapeLike(search)}%`;
        conditions.push('(r.return_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR r.lot_number LIKE ?)');
        params.push(like, like, like, like);
    }
    if (from) { conditions.push('r.return_datetime >= ?'); params.push(`${from} 00:00:00`); }
    if (to) { conditions.push('r.return_datetime <= ?'); params.push(`${to} 23:59:59`); }

    return { whereSql: conditions.join(' AND '), params };
};

// Kondisi untuk tampilan Ready to Ship; dipasang pada hasil gabungan lot (alias x): produk atau nomor lot
const buildReadyFilters = (query) => {
    const search = asText(query.search);
    if (!search) return { whereSql: '1 = 1', params: [] };
    const like = `%${escapeLike(search)}%`;
    return {
        whereSql: '(x.product_code LIKE ? OR x.product_name LIKE ? OR x.lot_number LIKE ?)',
        params: [like, like, like]
    };
};

const LOT_COLLATE = 'COLLATE utf8mb4_unicode_ci';

// Subquery penghubung lot -> DO / retur lewat nomor lot (kode produk lama pada DO lama tetap terhubung)
const DO_OF_LOT_SQL = `SELECT 1 FROM delivery_order_lots dx JOIN delivery_orders dh ON dh.id = dx.delivery_order_id
        WHERE dx.lot_number ${LOT_COLLATE} = l.lot_number ${LOT_COLLATE}`;
const RETURN_OF_LOT_SQL = `SELECT 1 FROM delivery_returns rx WHERE rx.lot_number ${LOT_COLLATE} = l.lot_number ${LOT_COLLATE}`;

/**
 * @returns {{ whereSql: string, params: any[] }} kondisi untuk tampilan Lot Number (l, p).
 * Pencarian: nomor lot, kode / nama produk, nomor DO, nomor retur. Tanggal: lot yang punya DO atau retur dalam rentang.
 */
const buildLotFilters = (query, from, to) => {
    const conditions = ['1 = 1'];
    const params = [];

    const search = asText(query.search);
    if (search) {
        const like = `%${escapeLike(search)}%`;
        conditions.push(`(l.lot_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ?
            OR EXISTS (${DO_OF_LOT_SQL} AND dh.do_number LIKE ?)
            OR EXISTS (${RETURN_OF_LOT_SQL} AND rx.return_number LIKE ?))`);
        params.push(like, like, like, like, like);
    }
    if (from || to) {
        const doConditions = [];
        const returnConditions = [];
        const rangeParams = [];
        if (from) {
            doConditions.push('dx.do_datetime >= ?');
            returnConditions.push('rx.return_datetime >= ?');
            rangeParams.push(`${from} 00:00:00`);
        }
        if (to) {
            doConditions.push('dx.do_datetime <= ?');
            returnConditions.push('rx.return_datetime <= ?');
            rangeParams.push(`${to} 23:59:59`);
        }
        conditions.push(`(EXISTS (${DO_OF_LOT_SQL} AND ${doConditions.join(' AND ')})
            OR EXISTS (${RETURN_OF_LOT_SQL} AND ${returnConditions.join(' AND ')}))`);
        params.push(...rangeParams, ...rangeParams);
    }

    return { whereSql: conditions.join(' AND '), params };
};

// Rentang tanggal DO / retur dari query (kosong = tanpa batas); from tidak boleh melewati to
const parseDateRange = (query) => {
    const from = parseDateParam(query.fromDoDate, 'From date');
    const to = parseDateParam(query.toDoDate, 'To date');
    if (from && to && from > to) {
        throw new BusinessError('From date must not be later than To date.', 400);
    }
    return { from, to };
};

/**
 * Seluruh parameter daftar: filter + mode tampilan + halaman + urutan.
 */
const parseDeliveryOrderRequest = (query = {}) => {
    const displayMode = asText(query.displayMode) || 'BY_DO';
    if (!DISPLAY_MODES.includes(displayMode)) {
        throw new BusinessError('Invalid display mode.', 400);
    }

    const { from, to } = parseDateRange(query);

    let filters;
    if (displayMode === 'BY_RETURN') filters = buildReturnFilters(query, from, to);
    else if (displayMode === 'BY_LOT') filters = buildLotFilters(query, from, to);
    else if (displayMode === 'READY_TO_SHIP') filters = buildReadyFilters(query);
    else filters = buildDoFilters(query, from, to);
    const { page, limit, offset } = parsePageParams(query, { defaultLimit: DEFAULT_PAGE_LIMIT, maxLimit: MAX_PAGE_LIMIT });

    return { displayMode, ...filters, page, limit, offset, order: orderOf(query.sortOrder) };
};

/**
 * Parameter ekspor: pencarian dan rentang tanggal yang sama dengan daftar, berlaku untuk pengiriman DO dan retur
 * sekaligus. Tanpa mode tampilan dan tanpa halaman.
 */
const parseDeliveryOrderExportRequest = (query = {}) => {
    const { from, to } = parseDateRange(query);
    return {
        deliveries: buildDoFilters(query, from, to),
        returns: buildReturnFilters(query, from, to)
    };
};

module.exports = {
    DISPLAY_MODES,
    MAX_PAGE_LIMIT,
    DEFAULT_PAGE_LIMIT,
    DO_FROM_SQL,
    RETURN_FROM_SQL,
    LOT_FROM_SQL,
    parseDeliveryOrderRequest,
    parseDeliveryOrderExportRequest
};
