'use strict';

/**
 * Membaca dan memvalidasi parameter daftar Delivery Order (tanpa akses database).
 *
 * Tiga tampilan:
 *  BY_DO     : delivery_order_lots (alias dol) + delivery_orders (d) + products (p)
 *  BY_LOT    : sama dengan BY_DO, dikelompokkan per nomor lot
 *  BY_RETURN : delivery_returns (r) + products (p)
 */

const { BusinessError } = require('../../helpers/businessError');
const { asText, parsePageParams, parseDateParam, escapeLike } = require('../../helpers/queryParams');

const DISPLAY_MODES = Object.freeze(['BY_DO', 'BY_LOT', 'BY_RETURN']);
const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 10;

const DO_FROM_SQL = `FROM delivery_order_lots dol
    JOIN delivery_orders d ON dol.delivery_order_id = d.id
    JOIN products p ON dol.product_id = p.id_product`;

const RETURN_FROM_SQL = `FROM delivery_returns r
    JOIN products p ON r.product_id = p.id_product`;

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

/**
 * Seluruh parameter daftar: filter + mode tampilan + halaman + urutan.
 */
const parseDeliveryOrderRequest = (query = {}) => {
    const displayMode = asText(query.displayMode) || 'BY_DO';
    if (!DISPLAY_MODES.includes(displayMode)) {
        throw new BusinessError('Invalid display mode.', 400);
    }

    const from = parseDateParam(query.fromDoDate, 'From date');
    const to = parseDateParam(query.toDoDate, 'To date');
    if (from && to && from > to) {
        throw new BusinessError('From date must not be later than To date.', 400);
    }

    const filters = displayMode === 'BY_RETURN'
        ? buildReturnFilters(query, from, to)
        : buildDoFilters(query, from, to);
    const { page, limit, offset } = parsePageParams(query, { defaultLimit: DEFAULT_PAGE_LIMIT, maxLimit: MAX_PAGE_LIMIT });

    return { displayMode, ...filters, page, limit, offset, order: orderOf(query.sortOrder) };
};

module.exports = {
    DISPLAY_MODES,
    MAX_PAGE_LIMIT,
    DEFAULT_PAGE_LIMIT,
    DO_FROM_SQL,
    RETURN_FROM_SQL,
    parseDeliveryOrderRequest
};
