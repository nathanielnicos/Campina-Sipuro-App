'use strict';

/**
 * Perkiraan PO untuk Delivery Order (hanya tampilan; tidak menyimpan apa pun, tidak mengubah nilai DO).
 *
 * Alokasi lot ke PO sudah tersimpan per PO, tetapi DO tidak membawa nomor PO. Karena satu lot bisa dipegang beberapa PO
 * dan satu DO bisa terdiri dari beberapa PO, PO-nya diperkirakan dengan FIFO per (keluarga produk, nomor lot):
 *   - antrean alokasi: PO diurutkan dari tanggal PO tertua (lalu id detail PO),
 *   - baris DO diurutkan dari tanggal DO tertua (lalu nomor DO), lalu mengambil qty dari antrean berurutan.
 * Semua DO pada lot itu (bukan hanya yang tampil di halaman) ikut dihitung, supaya konsumsi antrean benar.
 * Retur (RMA) mengurangi DO yang paling tua lebih dulu per (keluarga produk, nomor lot), karena retur membuka kuota
 * kirim lagi dan tidak membawa nomor DO (perkiraan FIFO juga). Qty yang sudah diretur tidak ikut diperkirakan: baris DO yang
 * seluruhnya diretur tidak punya PO, retur sebagian hanya memperkirakan sisa qty, dan antrean PO yang dibebaskan retur
 * dipakai DO berikutnya. Nilai DO yang tersimpan tidak berubah.
 * Kode produk yang dipetakan (mis. 00045 dan 00047) berbagi satu antrean (lihat stockFamilyKey).
 */

const { BusinessError } = require('../../helpers/businessError');
const { chunk } = require('../../helpers/arrayUtils');
const { NOT_DELETED_SQL } = require('../../helpers/po/openItemRules');
const { ALLOCATION_STATUS } = require('../production-lot/lotAllocationRules');
const { stockKey } = require('./deliveryOrderRules');
const { buildStockCodeResolver } = require('../product-code-mapping/stockFamilyKey');

const MAX_DO_IDS = 100;

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const num = (v) => Number(v) || 0;

/** "doIds=1,2,3" -> [1,2,3]; kosong atau tidak valid -> 400 */
const parseEstimatedPoRequest = (query = {}) => {
    const raw = Array.isArray(query.doIds) ? query.doIds.join(',') : String(query.doIds || '');
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) throw new BusinessError('doIds is required.', 400);
    if (parts.length > MAX_DO_IDS) throw new BusinessError(`At most ${MAX_DO_IDS} delivery orders per request.`, 400);
    const ids = parts.map((s) => (/^\d+$/.test(s) ? Number(s) : NaN));
    if (ids.some((n) => !Number.isSafeInteger(n) || n <= 0)) throw new BusinessError('doIds must be positive integers.', 400);
    return { doIds: [...new Set(ids)] };
};

/**
 * FIFO per (keluarga produk, lot).
 * @param {{ allocations: Array, lines: Array, stockCodes: { forProductCode: Function } }} input
 *   allocations: { po_detail_id, po_number, po_created_at, po_product_code, lot_number, lot_product_code, total_qty }
 *   lines: { id, delivery_order_id, do_number, do_datetime, id_product, product_code, lot_number, qty_pcs }
 *   returns: { product_code, lot_number, total_qty } total retur per kode produk dan lot (opsional)
 * @returns {Map<number, { segments: Array, unassignedQty: number, returnedQty: number }>} kunci = id baris DO (line.id)
 */
const estimateLines = ({ allocations = [], lines = [], returns = [], stockCodes }) => {
    const queues = new Map();
    allocations.forEach((a) => {
        const qty = num(a.total_qty);
        if (qty <= 0) return;
        const key = stockKey(stockCodes.forProductCode(a.lot_product_code), a.lot_number);
        if (!queues.has(key)) queues.set(key, new Map());
        const byPo = queues.get(key);
        const cur = byPo.get(a.po_detail_id);
        if (cur) { cur.remaining += qty; return; }
        byPo.set(a.po_detail_id, {
            poDetailId: a.po_detail_id,
            poNumber: a.po_number,
            poProductCode: a.po_product_code,
            createdAt: a.po_created_at || '',
            remaining: qty
        });
    });
    const sortedQueues = new Map();
    queues.forEach((byPo, key) => {
        sortedQueues.set(key, [...byPo.values()].sort((x, y) => cmp(x.createdAt, y.createdAt) || (x.poDetailId - y.poDetailId)));
    });

    // Retur per (keluarga produk, lot): mengurangi DO tertua lebih dulu
    const returnPool = new Map();
    returns.forEach((r) => {
        const key = stockKey(stockCodes.forProductCode(r.product_code), r.lot_number);
        returnPool.set(key, (returnPool.get(key) || 0) + num(r.total_qty));
    });

    const result = new Map();
    [...lines]
        .sort((a, b) => cmp(a.do_datetime, b.do_datetime) || cmp(a.do_number, b.do_number) || (a.id - b.id))
        .forEach((line) => {
            const key = stockKey(stockCodes.forProductCode(line.product_code), line.lot_number);
            const queue = sortedQueues.get(key) || [];
            const returnedQty = Math.min(num(line.qty_pcs), returnPool.get(key) || 0);
            if (returnedQty > 0) returnPool.set(key, returnPool.get(key) - returnedQty);
            let need = num(line.qty_pcs) - returnedQty;
            const segments = [];
            for (const entry of queue) {
                if (need <= 0) break;
                if (entry.remaining <= 0) continue;
                const take = Math.min(entry.remaining, need);
                entry.remaining -= take;
                need -= take;
                segments.push({
                    po_detail_id: entry.poDetailId,
                    po_number: entry.poNumber,
                    po_product_code: entry.poProductCode,
                    qty_pcs: take,
                    via_mapping: entry.poProductCode !== line.product_code
                });
            }
            result.set(line.id, { segments, unassignedQty: need, returnedQty });
        });
    return result;
};

// Gabungkan segmen dengan PO yang sama (urutan kemunculan pertama dipertahankan)
const mergeSegments = (segmentLists) => {
    const merged = new Map();
    segmentLists.flat().forEach((s) => {
        const cur = merged.get(s.po_detail_id);
        if (cur) cur.qty_pcs += s.qty_pcs;
        else merged.set(s.po_detail_id, { ...s });
    });
    return [...merged.values()];
};

/**
 * Susun hasil per DO yang diminta: DO -> item -> lot, masing-masing dengan daftar PO perkiraan.
 */
const shapeEstimate = (doIds, lines, estimates) => {
    const wanted = new Set(doIds);
    const doMap = new Map();
    lines.filter((l) => wanted.has(l.delivery_order_id)).forEach((line) => {
        const est = estimates.get(line.id) || { segments: [], unassignedQty: num(line.qty_pcs), returnedQty: 0 };
        if (!doMap.has(line.delivery_order_id)) doMap.set(line.delivery_order_id, { delivery_order_id: line.delivery_order_id, items: new Map() });
        const order = doMap.get(line.delivery_order_id);
        if (!order.items.has(line.id_product)) order.items.set(line.id_product, { id_product: line.id_product, lots: new Map() });
        const item = order.items.get(line.id_product);
        const lot = item.lots.get(line.lot_number) || { lot_number: line.lot_number, segs: [], unassigned_qty: 0, returned_qty: 0 };
        lot.segs.push(est.segments);
        lot.unassigned_qty += est.unassignedQty;
        lot.returned_qty += est.returnedQty || 0;
        item.lots.set(line.lot_number, lot);
    });

    return doIds.filter((id) => doMap.has(id)).map((id) => {
        const order = doMap.get(id);
        const items = [...order.items.values()].map((item) => {
            const lots = [...item.lots.values()]
                .sort((a, b) => cmp(a.lot_number, b.lot_number))
                .map((l) => ({ lot_number: l.lot_number, pos: mergeSegments(l.segs), unassigned_qty: l.unassigned_qty, returned_qty: l.returned_qty }));
            return {
                id_product: item.id_product,
                pos: mergeSegments(lots.map((l) => l.pos)),
                unassigned_qty: lots.reduce((s, l) => s + l.unassigned_qty, 0),
                returned_qty: lots.reduce((s, l) => s + l.returned_qty, 0),
                lots
            };
        });
        return { delivery_order_id: id, items };
    });
};

const ALLOCATIONS_SQL = `SELECT pla.po_detail_id, h.po_number,
        DATE_FORMAT(h.created_at, '%Y-%m-%d %H:%i:%s') AS po_created_at,
        pp.product_code AS po_product_code, lp.product_code AS lot_product_code, l.lot_number,
        SUM(pla.allocated_qty) AS total_qty
    FROM po_lot_allocations pla
    JOIN po_details d ON pla.po_detail_id = d.po_detail_id
    JOIN po_headers h ON d.po_header_id = h.po_header_id
    JOIN lots l ON pla.lot_id = l.id
    JOIN products lp ON l.id_product = lp.id_product
    JOIN products pp ON d.id_product = pp.id_product
    WHERE l.lot_number IN (?) AND pla.status <> '${ALLOCATION_STATUS.CANCELED}' AND ${NOT_DELETED_SQL}
    GROUP BY pla.po_detail_id, h.po_number, h.created_at, pp.product_code, lp.product_code, l.lot_number`;

const RETURNS_SQL = `SELECT p.product_code, r.lot_number, SUM(r.qty_pcs) AS total_qty
    FROM delivery_returns r
    JOIN products p ON r.product_id = p.id_product
    WHERE r.lot_number IN (?)
    GROUP BY p.product_code, r.lot_number`;

const LINES_SQL = `SELECT dol.id, dol.delivery_order_id, d.do_number,
        DATE_FORMAT(dol.do_datetime, '%Y-%m-%d %H:%i:%s') AS do_datetime,
        p.id_product, p.product_code, dol.lot_number, dol.qty_pcs
    FROM delivery_order_lots dol
    JOIN delivery_orders d ON dol.delivery_order_id = d.id
    JOIN products p ON dol.product_id = p.id_product
    WHERE dol.lot_number IN (?)`;

/**
 * @returns {Promise<Array>} perkiraan PO untuk DO yang diminta (DO yang tidak ada dilewati)
 */
const fetchEstimatedPo = async (queryable, doIds) => {
    const [lotRows] = await queryable.query(
        'SELECT DISTINCT lot_number FROM delivery_order_lots WHERE delivery_order_id IN (?)',
        [doIds]
    );
    const lotNumbers = lotRows.map((r) => r.lot_number);
    if (lotNumbers.length === 0) return [];

    const [products] = await queryable.query('SELECT id_product, product_code FROM products');
    const [mappings] = await queryable.query(
        'SELECT id_product_old, id_product_new FROM product_code_mappings WHERE is_active = 1'
    );
    const stockCodes = buildStockCodeResolver(products, mappings);

    const allocations = [];
    const lines = [];
    const returns = [];
    for (const part of chunk(lotNumbers, 500)) {
        const [a] = await queryable.query(ALLOCATIONS_SQL, [part]);
        allocations.push(...a);
        const [l] = await queryable.query(LINES_SQL, [part]);
        lines.push(...l.map((r) => ({ ...r, qty_pcs: num(r.qty_pcs) })));
        const [ret] = await queryable.query(RETURNS_SQL, [part]);
        returns.push(...ret);
    }

    return shapeEstimate(doIds, lines, estimateLines({ allocations, lines, returns, stockCodes }));
};

module.exports = { MAX_DO_IDS, parseEstimatedPoRequest, estimateLines, shapeEstimate, fetchEstimatedPo };
