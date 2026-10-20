'use strict';

/**
 * Penyusun query daftar Outstanding PO (tanpa akses database, mudah dites).
 *
 * KONTRAK DATA: modul ini hanya membaca po_details, po_headers, dan products.
 * Qty yang sudah terpenuhi diambil dari po_details.fulfilled_qty; setiap modul alokasi
 * (batch sekarang, lot nanti) wajib menjaga kolom itu tetap sinkron.
 */

const { BusinessError } = require('../businessError');

const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 10;
const ITEM_STATUSES = ['Active', 'Close Requested', 'Closed', 'Partially Closed'];

const SORT_COLUMNS = {
    product_code: 'p.product_code',
    product_name: 'p.product_name',
    total_required_qty: 'total_required_qty',
    total_produced_qty: 'total_produced_qty',
    total_remaining_qty: 'total_remaining_qty',
    total_po_count: 'total_po_count'
};

// Sisa hanya dihitung untuk item yang masih berjalan; item Closed/Partially Closed sisanya sudah dilepas.
const REMAINING_SQL = `CASE WHEN d.status IN ('Active', 'Close Requested')
        THEN GREATEST(0, d.base_qty - IFNULL(d.fulfilled_qty, 0)) ELSE 0 END`;

// Yang tampil: PO Approved; item yang masih berjalan dan belum terpenuhi, ditambah item yang sudah di-close.
const BASE_CONDITIONS = [
    'd.deleted_at IS NULL',
    `h.status = 'Approved'`,
    `((d.status IN ('Active', 'Close Requested') AND IFNULL(d.fulfilled_qty, 0) < d.base_qty)
        OR d.status IN ('Closed', 'Partially Closed'))`
];

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const parsePositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseDateParam = (value, label) => {
    const text = asText(value);
    if (!text) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (match) {
        const [, year, month, day] = match.map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
            return text;
        }
    }
    throw new BusinessError(`${label} must be a valid date (YYYY-MM-DD).`, 400);
};

// Karakter khusus LIKE (% _ \) dianggap teks biasa.
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

/**
 * @param {object} query  req.query
 * @param {object} user   req.user (dari token)
 */
const buildListQuery = (query = {}, user) => {
    if (!user) {
        throw new BusinessError('You do not have permission to access this resource.', 403);
    }

    const conditions = [...BASE_CONDITIONS];
    const params = [];

    // Customer hanya melihat PO perusahaannya sendiri; identitas dari token, bukan dari request.
    if (user.type === 'CUSTOMER') {
        if (!user.customerId) {
            throw new BusinessError('You do not have permission to access this resource.', 403);
        }
        conditions.push('h.customer_id = ?');
        params.push(user.customerId);
    }

    const status = asText(query.status);
    if (status) {
        if (!ITEM_STATUSES.includes(status)) {
            throw new BusinessError('Invalid status filter.', 400);
        }
        conditions.push('d.status = ?');
        params.push(status);
    }

    const searchProduct = asText(query.searchProduct);
    if (searchProduct) {
        const like = `%${escapeLike(searchProduct)}%`;
        conditions.push('(p.product_code LIKE ? OR p.product_name LIKE ?)');
        params.push(like, like);
    }

    const searchPo = asText(query.searchPo);
    if (searchPo) {
        conditions.push('h.po_number LIKE ?');
        params.push(`%${escapeLike(searchPo)}%`);
    }

    const fromDate = parseDateParam(query.fromCreatedDate, 'From date');
    const toDate = parseDateParam(query.toCreatedDate, 'To date');
    if (fromDate && toDate && fromDate > toDate) {
        throw new BusinessError('From date must not be later than To date.', 400);
    }
    if (fromDate) {
        conditions.push('h.created_at >= ?');
        params.push(`${fromDate} 00:00:00`);
    }
    if (toDate) {
        conditions.push('h.created_at <= ?');
        params.push(`${toDate} 23:59:59`);
    }

    const page = parsePositiveInt(query.page, 1);
    const limit = Math.min(MAX_PAGE_LIMIT, parsePositiveInt(query.limit, DEFAULT_PAGE_LIMIT));
    const offset = (page - 1) * limit;

    const sortKey = asText(query.sortKey);
    const sortColumn = Object.prototype.hasOwnProperty.call(SORT_COLUMNS, sortKey) ? SORT_COLUMNS[sortKey] : 'p.product_code';
    const sortOrder = asText(query.sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    // p.id_product sebagai pembeda terakhir agar urutan antar halaman stabil.
    const orderBySql = `ORDER BY ${sortColumn} ${sortOrder}, p.id_product ASC`;

    return {
        whereSql: conditions.join(' AND '),
        params,
        page,
        limit,
        offset,
        orderBySql
    };
};

module.exports = {
    MAX_PAGE_LIMIT,
    DEFAULT_PAGE_LIMIT,
    ITEM_STATUSES,
    REMAINING_SQL,
    buildListQuery
};
