'use strict';

/**
 * Membaca dan memvalidasi parameter daftar mapping Production Lot (tanpa akses database).
 * Dipakai bersama oleh daftar mapping dan ekspor Excel, sehingga keduanya memakai aturan filter yang sama.
 *
 * Satu baris hasil = satu alokasi (item PO, lot, batch), dibaca dari po_lot_allocations.id_batch.
 * Alias tetap: pla (alokasi), d (item PO), h (header PO), p (produk), l (lot), b (batch).
 */

const { BusinessError } = require('../../helpers/businessError');
const { asText, parsePageParams, parseDateParam, escapeLike } = require('../../helpers/queryParams');
const { NOT_DELETED_SQL } = require('../../helpers/po/openItemRules');
const { ALLOCATION_STATUS } = require('./lotAllocationRules');

const DISPLAY_MODES = Object.freeze(['BY_PO', 'BY_BATCH', 'BY_LOT']);
const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 10;
const ALLOCATION_STATUS_VALUES = Object.freeze(Object.values(ALLOCATION_STATUS));

const MAPPING_FROM_SQL = `FROM po_lot_allocations pla
    JOIN po_details d ON pla.po_detail_id = d.po_detail_id
    JOIN po_headers h ON d.po_header_id = h.po_header_id
    JOIN products p ON d.id_product = p.id_product
    JOIN lots l ON pla.lot_id = l.id
    JOIN batches b ON pla.id_batch = b.id`;

const orderOf = (sortOrder) => (asText(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC');

/**
 * Filter saja (tanpa tampilan/halaman): dipakai juga oleh ekspor.
 * @returns {{ whereSql: string, params: any[] }}
 */
const buildMappingFilters = (query = {}) => {
    const conditions = [NOT_DELETED_SQL];
    const params = [];

    const search = asText(query.search);
    if (search) {
        const like = `%${escapeLike(search)}%`;
        conditions.push('(b.batch_number LIKE ? OR l.lot_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ? OR h.po_number LIKE ?)');
        params.push(like, like, like, like, like);
    }

    const status = asText(query.status);
    if (status) {
        if (!ALLOCATION_STATUS_VALUES.includes(status)) {
            throw new BusinessError('Invalid status filter.', 400);
        }
        conditions.push('pla.status = ?');
        params.push(status);
    }

    const fromActual = parseDateParam(query.fromActualDate, 'From actual date');
    const toActual = parseDateParam(query.toActualDate, 'To actual date');
    if (fromActual && toActual && fromActual > toActual) {
        throw new BusinessError('From actual date must not be later than To actual date.', 400);
    }
    if (fromActual) {
        conditions.push('l.actual_completed_datetime >= ?');
        params.push(`${fromActual} 00:00:00`);
    }
    if (toActual) {
        conditions.push('l.actual_completed_datetime <= ?');
        params.push(`${toActual} 23:59:59`);
    }

    const fromCreated = parseDateParam(query.fromCreatedDate, 'From created date');
    const toCreated = parseDateParam(query.toCreatedDate, 'To created date');
    if (fromCreated && toCreated && fromCreated > toCreated) {
        throw new BusinessError('From created date must not be later than To created date.', 400);
    }
    if (fromCreated) {
        conditions.push('h.created_at >= ?');
        params.push(`${fromCreated} 00:00:00`);
    }
    if (toCreated) {
        conditions.push('h.created_at <= ?');
        params.push(`${toCreated} 23:59:59`);
    }

    return { whereSql: conditions.join(' AND '), params };
};

/**
 * Seluruh parameter daftar: filter + mode tampilan + halaman + urutan.
 */
const parseMappingRequest = (query = {}) => {
    const displayMode = asText(query.displayMode) || 'BY_PO';
    if (!DISPLAY_MODES.includes(displayMode)) {
        throw new BusinessError('Invalid display mode.', 400);
    }

    const filters = buildMappingFilters(query);
    const { page, limit, offset } = parsePageParams(query, { defaultLimit: DEFAULT_PAGE_LIMIT, maxLimit: MAX_PAGE_LIMIT });

    return {
        displayMode,
        ...filters,
        page,
        limit,
        offset,
        order: orderOf(query.sortOrder),
        sortKey: asText(query.sortKey)
    };
};

module.exports = {
    DISPLAY_MODES,
    MAX_PAGE_LIMIT,
    DEFAULT_PAGE_LIMIT,
    MAPPING_FROM_SQL,
    buildMappingFilters,
    parseMappingRequest
};
