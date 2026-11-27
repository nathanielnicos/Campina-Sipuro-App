'use strict';

/**
 * Perkiraan PO untuk Delivery Order dan retur (hanya tampilan; tidak menyimpan apa pun, tidak mengubah nilai DO / retur).
 *
 * Alokasi lot ke PO sudah tersimpan per PO, tetapi DO dan retur tidak membawa nomor PO (nomor sales order di file
 * bukan nomor PO). Karena satu lot bisa dipegang beberapa PO dan satu DO bisa terdiri dari beberapa PO, PO-nya
 * diperkirakan dengan SIMULASI KRONOLOGIS per (keluarga produk, nomor lot):
 *   - antrean alokasi: PO diurutkan dari tanggal PO tertua (lalu id detail PO); tiap PO punya kapasitas = total alokasi;
 *   - semua kejadian lot (baris DO dan baris retur) diurutkan menurut waktu; pada waktu sama DO dulu baru retur;
 *   - baris DO mengambil qty dari antrean berurutan (PO tertua yang masih punya kapasitas);
 *   - baris retur DICOCOKKAN ke DO yang sudah terjadi sebelumnya (tanggal DO <= tanggal retur) dan masih punya qty
 *     yang belum diretur, dari DO TERBARU lebih dulu (RETURN_MATCH.LATEST_FIRST), agar DO lama tidak tersenggol
 *     di tengah-tengah. Qty retur melepas kembali kapasitas PO yang tadi dipakai DO itu; pengiriman ulang sesudahnya
 *     memakai PO tertua yang terbuka lagi (biasanya PO yang sama), tanpa mengubah riwayat DO lama.
 *   - dalam satu DO yang diretur sebagian: bagian "unassigned" dilepas lebih dulu, lalu segmen PO dari yang paling
 *     akhir diambil.
 * Hasilnya TIDAK PERNAH menghilangkan atau menggandakan qty: tiap baris DO = jumlah segmen PO + unassigned, tiap baris
 * retur = qty yang dilepas + unmatched (retur melebihi pengiriman sebelumnya, ditandai eksplisit), dan pemakaian bersih
 * tiap PO (kirim - retur) tidak pernah negatif atau melebihi alokasinya. Aturan ini dijaga checkEstimateIntegrity.
 * Semua DO dan retur pada lot itu (bukan hanya yang tampil di halaman) ikut disimulasikan.
 * Kode produk yang dipetakan (mis. 00045 dan 00047) berbagi satu antrean (lihat stockFamilyKey).
 * Ini perkiraan, bukan data tercatat.
 */

const { BusinessError } = require('../../utils/businessError');
const { chunk } = require('../../utils/arrayUtils');
const { NOT_DELETED_SQL } = require('../purchase-order/openItemRules');
const { ALLOCATION_STATUS } = require('../production-lot/lotAllocationRules');
const { stockKey } = require('./deliveryOrderRules');
const { buildStockCodeResolver } = require('../product-code-mapping/stockFamilyKey');

const MAX_DO_IDS = 100;
const MAX_RETURN_NUMBERS = 100;
const MAX_RETURN_NUMBER_LENGTH = 64;

// Aturan mencocokkan retur ke DO (satu-satunya tempat mengganti aturan ini)
const RETURN_MATCH = Object.freeze({ LATEST_FIRST: 'LATEST_FIRST', OLDEST_FIRST: 'OLDEST_FIRST' });
const DEFAULT_RETURN_MATCH = RETURN_MATCH.LATEST_FIRST;

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const num = (v) => Number(v) || 0;
const text = (v) => (v === null || v === undefined ? '' : String(v));

// ---------- Parameter ----------

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

/** "returnNumbers=1200004773,1200004774" -> teks unik; kosong / terlalu banyak / terlalu panjang -> 400 */
const parseEstimatedReturnRequest = (query = {}) => {
    const raw = Array.isArray(query.returnNumbers) ? query.returnNumbers.join(',') : String(query.returnNumbers || '');
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) throw new BusinessError('returnNumbers is required.', 400);
    if (parts.length > MAX_RETURN_NUMBERS) throw new BusinessError(`At most ${MAX_RETURN_NUMBERS} returns per request.`, 400);
    if (parts.some((s) => s.length > MAX_RETURN_NUMBER_LENGTH)) throw new BusinessError('returnNumbers contains an invalid value.', 400);
    return { returnNumbers: [...new Set(parts)] };
};

// ---------- Simulasi ----------

const keyOf = (stockCodes, code, lot) => stockKey(stockCodes.forProductCode(code), lot);

// Antrean alokasi satu kunci: baris PO yang sama (beda batch) dijumlahkan, urut PO tertua
const buildQueue = (allocations) => {
    const byPo = new Map();
    allocations.forEach((a) => {
        const qty = num(a.total_qty);
        if (qty <= 0) return;
        const cur = byPo.get(a.po_detail_id);
        if (cur) { cur.capacity += qty; cur.remaining += qty; return; }
        byPo.set(a.po_detail_id, {
            poDetailId: a.po_detail_id,
            poNumber: a.po_number,
            poProductCode: a.po_product_code,
            createdAt: a.po_created_at || '',
            capacity: qty,
            remaining: qty
        });
    });
    return [...byPo.values()].sort((x, y) => cmp(x.createdAt, y.createdAt) || (x.poDetailId - y.poDetailId));
};

const EVENT_RANK = { DO: 0, RETURN: 1 };

// Satu kunci (keluarga produk, lot): semua kejadian berurutan waktu
const simulateKey = ({ allocations, lines, returnLines, returnMatch, doResults, returnResults }) => {
    const queue = buildQueue(allocations);

    const events = [
        ...lines.map((line) => ({ type: 'DO', time: text(line.do_datetime), number: text(line.do_number), id: num(line.id), line })),
        ...returnLines.map((ret) => ({ type: 'RETURN', time: text(ret.return_datetime), number: text(ret.return_number), id: num(ret.id), ret }))
    ].sort((a, b) => cmp(a.time, b.time) || (EVENT_RANK[a.type] - EVENT_RANK[b.type]) || cmp(a.number, b.number) || (a.id - b.id));

    const shipped = []; // baris DO yang sudah terjadi, urut waktu

    events.forEach((event) => {
        if (event.type === 'DO') {
            const { line } = event;
            const state = { line, qty: num(line.qty_pcs), segments: [], unassignedQty: 0, unassignedReturned: 0, returned: 0 };
            let need = state.qty;
            for (const entry of queue) {
                if (need <= 0) break;
                if (entry.remaining <= 0) continue;
                const take = Math.min(entry.remaining, need);
                entry.remaining -= take;
                need -= take;
                state.segments.push({ entry, qty: take, returned: 0 });
            }
            state.unassignedQty = need;
            shipped.push(state);
            doResults.set(line.id, state);
            return;
        }

        const { ret } = event;
        const releases = [];
        let unassignedReleased = 0;
        let left = num(ret.qty_pcs);
        const order = returnMatch === RETURN_MATCH.OLDEST_FIRST ? shipped : [...shipped].reverse();
        for (const state of order) {
            if (left <= 0) break;
            const outstanding = state.qty - state.returned;
            if (outstanding <= 0) continue;
            const take = Math.min(left, outstanding);
            left -= take;
            state.returned += take;
            let remainder = take;

            // bagian DO yang tidak tertutup alokasi dilepas lebih dulu
            const fromUnassigned = Math.min(remainder, state.unassignedQty - state.unassignedReturned);
            state.unassignedReturned += fromUnassigned;
            unassignedReleased += fromUnassigned;
            remainder -= fromUnassigned;

            const segments = returnMatch === RETURN_MATCH.OLDEST_FIRST ? state.segments : [...state.segments].reverse();
            for (const seg of segments) {
                if (remainder <= 0) break;
                const available = seg.qty - seg.returned;
                if (available <= 0) continue;
                const release = Math.min(available, remainder);
                seg.returned += release;
                seg.entry.remaining += release;
                remainder -= release;
                releases.push({ entry: seg.entry, qty: release, doNumber: state.line.do_number });
            }
        }
        returnResults.set(ret.id, { ret, releases, unassignedReleased, unmatchedQty: left });
    });
};

const groupBy = (items, keyFn) => {
    const map = new Map();
    items.forEach((item) => {
        const key = keyFn(item);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    });
    return map;
};

/**
 * Simulasi seluruh lot yang diberikan.
 * @param {{ allocations: Array, lines: Array, returnLines: Array, stockCodes: { forProductCode: Function }, returnMatch?: string }} input
 *   allocations: { po_detail_id, po_number, po_created_at, po_product_code, lot_number, lot_product_code, total_qty }
 *   lines (DO):  { id, delivery_order_id, do_number, do_datetime, id_product, product_code, lot_number, qty_pcs }
 *   returnLines: { id, return_number, return_datetime, id_product, product_code, lot_number, qty_pcs }
 * @returns {{ doResults: Map<number, object>, returnResults: Map<number, object> }} kunci = id baris DO / id baris retur
 */
const simulateLots = ({ allocations = [], lines = [], returnLines = [], stockCodes, returnMatch = DEFAULT_RETURN_MATCH }) => {
    const allocByKey = groupBy(allocations, (a) => keyOf(stockCodes, a.lot_product_code, a.lot_number));
    const linesByKey = groupBy(lines, (l) => keyOf(stockCodes, l.product_code, l.lot_number));
    const returnsByKey = groupBy(returnLines, (r) => keyOf(stockCodes, r.product_code, r.lot_number));

    const doResults = new Map();
    const returnResults = new Map();
    new Set([...linesByKey.keys(), ...returnsByKey.keys()]).forEach((key) => {
        simulateKey({
            allocations: allocByKey.get(key) || [],
            lines: linesByKey.get(key) || [],
            returnLines: returnsByKey.get(key) || [],
            returnMatch,
            doResults,
            returnResults
        });
    });
    return { doResults, returnResults };
};

/**
 * Pemeriksaan keutuhan hasil simulasi (tidak ada qty yang hilang atau ganda). Mengembalikan daftar pelanggaran;
 * kosong = utuh. Dipakai tes dan pengaman layanan.
 */
const checkEstimateIntegrity = ({ allocations = [], lines = [], returnLines = [], stockCodes }, { doResults, returnResults }) => {
    const problems = [];
    const capacity = new Map(); // `${key}|${po_detail_id}` -> kapasitas
    allocations.forEach((a) => {
        if (num(a.total_qty) <= 0) return;
        const k = `${keyOf(stockCodes, a.lot_product_code, a.lot_number)}|${a.po_detail_id}`;
        capacity.set(k, (capacity.get(k) || 0) + num(a.total_qty));
    });

    const net = new Map();
    const returnedByKey = new Map();
    const releasedByKey = new Map();
    const add = (map, key, value) => map.set(key, (map.get(key) || 0) + value);

    lines.forEach((line) => {
        const state = doResults.get(line.id);
        const key = keyOf(stockCodes, line.product_code, line.lot_number);
        if (!state) { problems.push(`DO line ${line.id}: no result`); return; }
        const qty = num(line.qty_pcs);
        const segQty = state.segments.reduce((s, x) => s + x.qty, 0);
        const segReturned = state.segments.reduce((s, x) => s + x.returned, 0);
        if (segQty + state.unassignedQty !== qty) problems.push(`DO line ${line.id}: segments + unassigned != qty`);
        if (state.returned !== segReturned + state.unassignedReturned) problems.push(`DO line ${line.id}: returned mismatch`);
        if (state.returned < 0 || state.returned > qty) problems.push(`DO line ${line.id}: returned out of range`);
        if (state.unassignedReturned < 0 || state.unassignedReturned > state.unassignedQty) problems.push(`DO line ${line.id}: unassigned returned out of range`);
        state.segments.forEach((seg) => {
            if (seg.returned < 0 || seg.returned > seg.qty) problems.push(`DO line ${line.id}: segment returned out of range`);
            add(net, `${key}|${seg.entry.poDetailId}`, seg.qty - seg.returned);
        });
        add(returnedByKey, key, state.returned);
    });

    returnLines.forEach((ret) => {
        const result = returnResults.get(ret.id);
        const key = keyOf(stockCodes, ret.product_code, ret.lot_number);
        if (!result) { problems.push(`Return line ${ret.id}: no result`); return; }
        const released = result.releases.reduce((s, x) => s + x.qty, 0) + result.unassignedReleased;
        if (released + result.unmatchedQty !== num(ret.qty_pcs)) problems.push(`Return line ${ret.id}: released + unmatched != qty`);
        if (result.unmatchedQty < 0) problems.push(`Return line ${ret.id}: negative unmatched`);
        add(releasedByKey, key, released);
    });

    new Set([...returnedByKey.keys(), ...releasedByKey.keys()]).forEach((key) => {
        if ((returnedByKey.get(key) || 0) !== (releasedByKey.get(key) || 0)) problems.push(`Lot ${key.split('\u0000')[1]}: returned qty of DOs != released qty of returns`);
    });
    net.forEach((used, k) => {
        if (used < 0) problems.push(`PO ${k}: negative net use`);
        if (used > (capacity.get(k) || 0)) problems.push(`PO ${k}: net use exceeds allocation`);
    });
    return problems;
};

// ---------- Susun hasil ----------

const poRef = (entry, productCode) => ({
    po_detail_id: entry.poDetailId,
    po_number: entry.poNumber,
    po_product_code: entry.poProductCode,
    via_mapping: entry.poProductCode !== productCode
});

// Gabungkan segmen dengan PO yang sama (urutan kemunculan pertama dipertahankan)
const mergePos = (lists) => {
    const merged = new Map();
    lists.flat().forEach((s) => {
        const cur = merged.get(s.po_detail_id);
        if (cur) {
            cur.qty_pcs += s.qty_pcs;
            cur.returned_pcs += s.returned_pcs || 0;
            (s.from || []).forEach((f) => {
                const same = cur.from.find((x) => x.do_number === f.do_number);
                if (same) same.qty_pcs += f.qty_pcs; else cur.from.push({ ...f });
            });
        } else {
            merged.set(s.po_detail_id, { ...s, returned_pcs: s.returned_pcs || 0, from: (s.from || []).map((f) => ({ ...f })) });
        }
    });
    return [...merged.values()];
};

const sum = (items, pick) => items.reduce((s, x) => s + pick(x), 0);

/**
 * Susun hasil per DO yang diminta: DO -> item -> lot, masing-masing dengan daftar PO perkiraan.
 * Tiap PO membawa qty_pcs (kirim) dan returned_pcs (diretur); unassigned_qty = sisa yang tidak tertutup alokasi
 * (setelah dikurangi retur); returned_qty = total retur yang dicocokkan ke DO itu.
 */
const shapeEstimate = (doIds, lines, doResults) => {
    const toPos = (list) => mergePos(list).map(({ from, ...rest }) => rest);
    const wanted = new Set(doIds);
    const doMap = new Map();
    lines.filter((l) => wanted.has(l.delivery_order_id)).forEach((line) => {
        const state = doResults.get(line.id);
        const segs = state
            ? state.segments.map((s) => ({ ...poRef(s.entry, line.product_code), qty_pcs: s.qty, returned_pcs: s.returned }))
            : [];
        const unassigned = state ? state.unassignedQty - state.unassignedReturned : num(line.qty_pcs);
        const returned = state ? state.returned : 0;

        if (!doMap.has(line.delivery_order_id)) doMap.set(line.delivery_order_id, { delivery_order_id: line.delivery_order_id, items: new Map() });
        const order = doMap.get(line.delivery_order_id);
        if (!order.items.has(line.id_product)) order.items.set(line.id_product, { id_product: line.id_product, lots: new Map() });
        const item = order.items.get(line.id_product);
        const lot = item.lots.get(line.lot_number) || { lot_number: line.lot_number, segs: [], unassigned_qty: 0, returned_qty: 0 };
        lot.segs.push(segs);
        lot.unassigned_qty += unassigned;
        lot.returned_qty += returned;
        item.lots.set(line.lot_number, lot);
    });

    return doIds.filter((id) => doMap.has(id)).map((id) => {
        const order = doMap.get(id);
        const items = [...order.items.values()].map((item) => {
            const lots = [...item.lots.values()]
                .sort((a, b) => cmp(a.lot_number, b.lot_number))
                .map((l) => ({ lot_number: l.lot_number, pos: toPos(l.segs), unassigned_qty: l.unassigned_qty, returned_qty: l.returned_qty }));
            return {
                id_product: item.id_product,
                pos: toPos(lots.map((l) => l.pos)),
                unassigned_qty: sum(lots, (l) => l.unassigned_qty),
                returned_qty: sum(lots, (l) => l.returned_qty),
                lots
            };
        });
        return { delivery_order_id: id, items };
    });
};

/**
 * Susun hasil per nomor retur: retur -> item -> lot. Tiap PO = PO yang kapasitasnya dilepas retur itu, membawa
 * `from` (DO asal perkiraan dan qty-nya). unmatched_qty = qty retur yang tidak punya pengiriman sebelumnya;
 * unassigned_released_qty = bagian yang berasal dari qty DO yang tidak tertutup alokasi.
 */
const shapeReturnEstimate = (returnNumbers, returnLines, returnResults) => {
    const toPos = (list) => mergePos(list).map(({ returned_pcs, ...rest }) => rest);
    const wanted = new Set(returnNumbers);
    const map = new Map();
    returnLines.filter((r) => wanted.has(r.return_number)).forEach((ret) => {
        const result = returnResults.get(ret.id);
        const pos = result
            ? result.releases.map((r) => ({
                ...poRef(r.entry, ret.product_code),
                qty_pcs: r.qty,
                returned_pcs: 0,
                from: [{ do_number: r.doNumber, qty_pcs: r.qty }]
            }))
            : [];
        const unmatched = result ? result.unmatchedQty : num(ret.qty_pcs);
        const unassignedReleased = result ? result.unassignedReleased : 0;

        if (!map.has(ret.return_number)) map.set(ret.return_number, { return_number: ret.return_number, items: new Map() });
        const entry = map.get(ret.return_number);
        if (!entry.items.has(ret.id_product)) entry.items.set(ret.id_product, { id_product: ret.id_product, lots: new Map() });
        const item = entry.items.get(ret.id_product);
        const lot = item.lots.get(ret.lot_number) || { lot_number: ret.lot_number, segs: [], unmatched_qty: 0, unassigned_released_qty: 0 };
        lot.segs.push(pos);
        lot.unmatched_qty += unmatched;
        lot.unassigned_released_qty += unassignedReleased;
        item.lots.set(ret.lot_number, lot);
    });

    return returnNumbers.filter((n) => map.has(n)).map((number) => {
        const entry = map.get(number);
        const items = [...entry.items.values()].map((item) => {
            const lots = [...item.lots.values()]
                .sort((a, b) => cmp(a.lot_number, b.lot_number))
                .map((l) => ({
                    lot_number: l.lot_number,
                    pos: toPos(l.segs),
                    unmatched_qty: l.unmatched_qty,
                    unassigned_released_qty: l.unassigned_released_qty
                }));
            return {
                id_product: item.id_product,
                pos: toPos(lots.map((l) => l.pos)),
                unmatched_qty: sum(lots, (l) => l.unmatched_qty),
                unassigned_released_qty: sum(lots, (l) => l.unassigned_released_qty),
                lots
            };
        });
        return { return_number: number, items };
    });
};

// ---------- Query ----------

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

const RETURN_LINES_SQL = `SELECT r.id, r.return_number,
        DATE_FORMAT(r.return_datetime, '%Y-%m-%d %H:%i:%s') AS return_datetime,
        p.id_product, p.product_code, r.lot_number, r.qty_pcs
    FROM delivery_returns r
    JOIN products p ON r.product_id = p.id_product
    WHERE r.lot_number IN (?)`;

const LINES_SQL = `SELECT dol.id, dol.delivery_order_id, d.do_number,
        DATE_FORMAT(dol.do_datetime, '%Y-%m-%d %H:%i:%s') AS do_datetime,
        p.id_product, p.product_code, dol.lot_number, dol.qty_pcs
    FROM delivery_order_lots dol
    JOIN delivery_orders d ON dol.delivery_order_id = d.id
    JOIN products p ON dol.product_id = p.id_product
    WHERE dol.lot_number IN (?)`;

// Seluruh alokasi, DO, dan retur untuk lot-lot yang diberikan, lalu simulasi
const simulateForLots = async (queryable, lotNumbers) => {
    const [products] = await queryable.query('SELECT id_product, product_code FROM products');
    const [mappings] = await queryable.query(
        'SELECT id_product_old, id_product_new FROM product_code_mappings WHERE is_active = 1'
    );
    const stockCodes = buildStockCodeResolver(products, mappings);

    const allocations = [];
    const lines = [];
    const returnLines = [];
    for (const part of chunk(lotNumbers, 500)) {
        const [a] = await queryable.query(ALLOCATIONS_SQL, [part]);
        allocations.push(...a);
        const [l] = await queryable.query(LINES_SQL, [part]);
        lines.push(...l.map((r) => ({ ...r, qty_pcs: num(r.qty_pcs) })));
        const [ret] = await queryable.query(RETURN_LINES_SQL, [part]);
        returnLines.push(...ret.map((r) => ({ ...r, qty_pcs: num(r.qty_pcs) })));
    }

    const input = { allocations, lines, returnLines, stockCodes };
    const result = simulateLots(input);
    const problems = checkEstimateIntegrity(input, result);
    if (problems.length > 0) {
        // Pengaman: simulasi tidak boleh menghilangkan / menggandakan qty; bila terjadi, catat agar bisa ditelusuri
        console.error('Estimated PO integrity problems:', problems.slice(0, 10));
    }
    return { ...result, lines, returnLines };
};

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

    const { doResults, lines } = await simulateForLots(queryable, lotNumbers);
    return shapeEstimate(doIds, lines, doResults);
};

/**
 * @returns {Promise<Array>} perkiraan PO untuk nomor retur yang diminta (nomor yang tidak ada dilewati)
 */
const fetchEstimatedReturnPo = async (queryable, returnNumbers) => {
    const [lotRows] = await queryable.query(
        'SELECT DISTINCT lot_number FROM delivery_returns WHERE return_number IN (?)',
        [returnNumbers]
    );
    const lotNumbers = lotRows.map((r) => r.lot_number);
    if (lotNumbers.length === 0) return [];

    const { returnResults, returnLines } = await simulateForLots(queryable, lotNumbers);
    return shapeReturnEstimate(returnNumbers, returnLines, returnResults);
};

module.exports = {
    MAX_DO_IDS,
    MAX_RETURN_NUMBERS,
    RETURN_MATCH,
    DEFAULT_RETURN_MATCH,
    parseEstimatedPoRequest,
    parseEstimatedReturnRequest,
    simulateLots,
    checkEstimateIntegrity,
    shapeEstimate,
    shapeReturnEstimate,
    fetchEstimatedPo,
    fetchEstimatedReturnPo
};
