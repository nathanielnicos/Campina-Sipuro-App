'use strict';

/**
 * Penyusunan ulang alokasi lot satu produk (beserta keluarga kodenya) mengikuti FIFO, fungsi murni tanpa database.
 * Dipakai SAMA PERSIS oleh pratinjau dan commit.
 *
 * Tujuan: menutup "lubang" alokasi (mis. baris minus yang terlambat di-upload) dengan menggeser alokasi lot
 * berikutnya maju, sehingga PO terlama terisi lebih dulu dan PO terakhir yang kosong. Total tiap (lot, batch) tidak berubah.
 *
 * Langkah:
 *  1. Edit qty manual (riwayat tanpa upload dan bukan hasil rebalance) dibatalkan dengan record lawan, mis. 500 -> 400
 *     dibatalkan 400 -> 500. Pembatalan harus muat dalam produksi bersih lot/batch dan tidak boleh membuat total lot di
 *     bawah qty terkirim bersih (terkirim - retur); bila tidak, proses diblokir dengan alasan yang jelas.
 *  2. Alokasi yang bisa digeser (status Open/Closed pada item PO yang aktif) dihitung ulang dari nol memakai kalkulator
 *     alokasi upload (aturan yang sama: lot berurut tanggal selesai, FIFO PO, kode lama didahulukan, filter tanggal PO).
 *     Alokasi Force Closed/Canceled dan alokasi pada item PO yang tidak aktif tidak disentuh, qty-nya tetap
 *     mengurangi kapasitas PO.
 *  3. Bila ada (lot, batch) yang tidak bisa ditempatkan penuh, proses diblokir (tidak ada hasil sebagian).
 */

const crypto = require('crypto');
const { buildFamilyIndex } = require('../product-code-mapping/productFamilies');
const { stockKey } = require('../delivery-order/deliveryOrderRules');
const { IDENTITY_STOCK_CODES } = require('../product-code-mapping/stockFamilyKey');
const { calculateLotFifoAllocation } = require('./lotAllocationCalculator');
const {
    ALLOCATION_STATUS,
    PO_DETAIL_STATUS,
    ELIGIBLE_HEADER_STATUSES,
    ELIGIBLE_ALLOCATION_STATUSES,
    allocationKey,
    lotBatchKey,
    lotKey
} = require('./lotAllocationRules');

const { REVERSAL_TYPE, SHIFT_TYPE } = require('./lotRebalanceTypes');

const TRANS_TYPE = Object.freeze({ REVERSAL: REVERSAL_TYPE, SHIFT: SHIFT_TYPE });

const num = (v) => Number(v) || 0;

/**
 * @param {object} input
 * @param {number} input.productId produk yang dipilih pengguna
 * @param {Array} input.allocations seluruh alokasi dari lot-lot keluarga produk (id, po_detail_id, lot_id, id_batch, allocated_qty, status)
 * @param {Array} input.lots lots (id, lot_number, id_product, actual_completed_datetime, expired_date)
 * @param {Array} input.batches batches (id, batch_number, id_product)
 * @param {Array} input.openPoDetails item PO (bentuk loadProductionLotContext)
 * @param {Array} input.allProducts
 * @param {Array} input.productMappings pemetaan kode aktif
 * @param {Map} input.manualDeltas allocation id -> jumlah perubahan qty manual bersih
 * @param {Map} input.netByLotBatch lotBatchKey -> produksi bersih (lot, batch)
 * @param {Map} input.netByLot lot id -> produksi bersih lot
 * @param {Map} input.firstCompleted lotBatchKey -> tanggal selesai pertama (urutan FIFO lot)
 * @param {Map} input.lotDelivered stockKey(kode kanonik keluarga, nomor lot) -> qty terkirim BERSIH (terkirim - retur; stok dipooling per keluarga produk)
 * @param {object} input.stockCodes penentu kode kanonik keluarga (stockFamilyKey); default: kode apa adanya
 */
const calculateRebalance = (input) => {
    const {
        productId, allocations = [], lots = [], batches = [], openPoDetails = [], allProducts = [], productMappings = [],
        manualDeltas = new Map(), netByLotBatch = new Map(), netByLot = new Map(), firstCompleted = new Map(), lotDelivered = new Map(),
        stockCodes = IDENTITY_STOCK_CODES
    } = input;

    const blockers = [];
    const families = buildFamilyIndex(productMappings);
    const familyIds = new Set(families.familyOf(productId).map(Number));

    const productById = new Map(allProducts.map((p) => [Number(p.id_product), p]));
    const lotById = new Map(lots.map((l) => [l.id, l]));
    const batchById = new Map(batches.map((b) => [b.id, b]));
    const poById = new Map(openPoDetails.map((po) => [po.po_detail_id, po]));

    const familyLots = new Set(lots.filter((l) => familyIds.has(Number(l.id_product))).map((l) => l.id));
    const scoped = allocations.filter((a) => familyLots.has(a.lot_id) && a.status !== ALLOCATION_STATUS.CANCELED);

    // Item PO yang ikut dalam rencana (sama dengan syarat kalkulator upload)
    const activePoIds = new Set(openPoDetails
        .filter((po) => po.detail_status === PO_DETAIL_STATUS.ACTIVE && ELIGIBLE_HEADER_STATUSES.includes(po.header_status))
        .map((po) => po.po_detail_id));

    const isMovable = (a) => ELIGIBLE_ALLOCATION_STATUSES.includes(a.status) && activePoIds.has(a.po_detail_id);
    const movable = scoped.filter(isMovable);
    const fixed = scoped.filter((a) => !isMovable(a));

    // ---------- 1. Pembatalan edit manual ----------
    const afterReversal = new Map(); // id alokasi -> qty setelah pembatalan
    const reversals = [];
    movable.forEach((a) => {
        const current = num(a.allocated_qty);
        const delta = num(manualDeltas.get(a.id));
        const restored = current - delta;
        if (restored < 0) {
            blockers.push(`Manual edit of allocation ${a.id} cannot be reversed: it would become negative (${restored}).`);
        }
        afterReversal.set(a.id, delta === 0 ? current : restored);
        if (delta !== 0) reversals.push({ allocationId: a.id, poDetailId: a.po_detail_id, lotId: a.lot_id, batchId: a.id_batch, manualDelta: delta, from: current, to: restored });
    });

    // Batas produksi dan qty terkirim hanya diperiksa untuk (lot, batch) dan lot yang terkena pembatalan
    const qtyAfter = (a) => (afterReversal.has(a.id) ? afterReversal.get(a.id) : num(a.allocated_qty));
    const touchedLots = new Set(reversals.map((r) => r.lotId));
    const touchedPairs = new Set(reversals.map((r) => lotBatchKey(r.lotId, r.batchId)));
    touchedPairs.forEach((pairKey) => {
        const total = scoped.filter((a) => lotBatchKey(a.lot_id, a.id_batch) === pairKey).reduce((s, a) => s + qtyAfter(a), 0);
        const net = num(netByLotBatch.get(pairKey));
        if (total > net) {
            const sample = scoped.find((a) => lotBatchKey(a.lot_id, a.id_batch) === pairKey);
            blockers.push(`Reversal exceeds the produced quantity of lot ${lotById.get(sample.lot_id).lot_number} / batch ${batchById.get(sample.id_batch).batch_number} (${total} allocated after reversal, ${net} produced).`);
        }
    });
    touchedLots.forEach((lotId) => {
        const lot = lotById.get(lotId);
        const total = scoped.filter((a) => a.lot_id === lotId).reduce((s, a) => s + qtyAfter(a), 0);
        const net = num(netByLot.get(lotId));
        if (total > net) blockers.push(`Reversal exceeds the produced quantity of lot ${lot.lot_number} (${total} allocated after reversal, ${net} produced).`);
        // Pengiriman dibukukan per (keluarga produk, nomor lot): nomor lot yang sama berkode lama dan baru berbagi satu kuota
        const sameNumberLotIds = new Set(lots.filter((l) => l.lot_number === lot.lot_number && familyLots.has(l.id)).map((l) => l.id));
        const pooledTotal = scoped.filter((a) => sameNumberLotIds.has(a.lot_id)).reduce((s, a) => s + qtyAfter(a), 0);
        const code = (productById.get(Number(lot.id_product)) || {}).product_code;
        const delivered = num(lotDelivered.get(stockKey(stockCodes.forProductCode(code), lot.lot_number)));
        if (pooledTotal < delivered) blockers.push(`Reversal would put lot ${lot.lot_number} below its net delivered quantity (${pooledTotal} allocated after reversal, ${delivered} delivered after returns).`);
    });

    // ---------- 2. Susun ulang dengan kalkulator alokasi upload ----------
    const totalByPair = new Map();
    movable.forEach((a) => {
        const k = lotBatchKey(a.lot_id, a.id_batch);
        totalByPair.set(k, num(totalByPair.get(k)) + qtyAfter(a));
    });

    const movableByPo = new Map();
    movable.forEach((a) => movableByPo.set(a.po_detail_id, num(movableByPo.get(a.po_detail_id)) + num(a.allocated_qty)));
    const baselinePos = openPoDetails.map((po) => ({
        ...po,
        fulfilled_qty: num(po.fulfilled_qty) - num(movableByPo.get(po.po_detail_id))
    }));

    const syntheticRows = [];
    [...totalByPair.entries()].sort().forEach(([pairKey, total], index) => {
        if (total <= 0) return;
        const [lotId, batchId] = pairKey.split('_').map(Number);
        const lot = lotById.get(lotId);
        const batch = batchById.get(batchId);
        const product = productById.get(Number(lot.id_product));
        syntheticRows.push({
            batchNumber: batch.batch_number,
            lotNumber: lot.lot_number,
            itemCode: product.product_code,
            lotStatus: 'GOOD',
            transType: TRANS_TYPE.SHIFT,
            matchBy: 'BATCH_LOT',
            qtyPac: total,
            rawAllocationQty: total,
            actualCompletedDatetime: firstCompleted.get(pairKey) || lot.actual_completed_datetime || null,
            expiredDate: lot.expired_date || null,
            rowHash: `rebalance-${pairKey}`,
            excelRowNumber: index + 1,
            qtyIsWhole: true
        });
    });

    const plan = syntheticRows.length === 0
        ? { detailedAllocations: [], unallocatedRows: [] }
        : calculateLotFifoAllocation(syntheticRows, [], baselinePos, allProducts, {
            existingBatches: batches,
            existingLots: lots,
            existingAllocations: fixed,
            productMappings
        });

    plan.unallocatedRows.forEach((row) => {
        blockers.push(`Lot ${row.lotNumber} / batch ${row.batchNumber} (${row.qtyPac}) cannot be placed: ${row.reason}.`);
    });

    // ---------- 3. Selisih antara kondisi sekarang dan hasil ----------
    const lotIdByKey = new Map(lots.map((l) => [lotKey(l.lot_number, l.id_product), l.id]));
    const batchIdByNumber = new Map(batches.map((b) => [b.batch_number, b.id]));
    const finalByKey = new Map();
    plan.detailedAllocations.forEach((d) => {
        const lotId = lotIdByKey.get(lotKey(d.lotNumber, d.idProduct));
        const batchId = d.batchId || batchIdByNumber.get(d.batchNumber);
        const key = allocationKey(d.poDetailId, lotId, batchId);
        finalByKey.set(key, num(finalByKey.get(key)) + num(d.addedQty));
    });

    const rowsByKey = new Map(movable.map((a) => [allocationKey(a.po_detail_id, a.lot_id, a.id_batch), a]));
    const reversalById = new Map(reversals.map((r) => [r.allocationId, r]));
    const keys = [...new Set([...rowsByKey.keys(), ...finalByKey.keys()])];

    const finalByPo = new Map();
    finalByKey.forEach((qty, key) => {
        const poDetailId = Number(key.split('_')[0]);
        finalByPo.set(poDetailId, num(finalByPo.get(poDetailId)) + qty);
    });
    const movableByPoBefore = movableByPo;
    const fulfilledAfterOf = (poDetailId) => {
        const po = poById.get(poDetailId);
        return num(po.fulfilled_qty) - num(movableByPoBefore.get(poDetailId)) + num(finalByPo.get(poDetailId));
    };

    const changes = [];
    keys.forEach((key) => {
        const row = rowsByKey.get(key);
        const [poDetailId, lotId, batchId] = key.split('_').map(Number);
        const current = row ? num(row.allocated_qty) : 0;
        const restored = row ? afterReversal.get(row.id) : 0;
        const final = num(finalByKey.get(key));
        if (final === current && restored === current) return;
        const po = poById.get(poDetailId);
        const lot = lotById.get(lotId);
        const steps = [];
        if (row && reversalById.has(row.id)) steps.push({ delta: restored - current, transType: TRANS_TYPE.REVERSAL });
        if (final !== restored) steps.push({ delta: final - restored, transType: TRANS_TYPE.SHIFT });
        changes.push({
            allocationId: row ? row.id : null,
            poDetailId,
            poNumber: po ? po.po_number : null,
            lotId,
            lotNumber: lot.lot_number,
            batchId,
            batchNumber: batchById.get(batchId).batch_number,
            currentQty: current,
            qtyAfterReversal: restored,
            finalQty: final,
            rowStatus: fulfilledAfterOf(poDetailId) >= num(po.base_qty) ? ALLOCATION_STATUS.CLOSED : ALLOCATION_STATUS.OPEN,
            steps
        });
    });
    changes.sort((x, y) => (x.lotNumber < y.lotNumber ? -1 : x.lotNumber > y.lotNumber ? 1 : 0)
        || (x.batchNumber < y.batchNumber ? -1 : x.batchNumber > y.batchNumber ? 1 : 0)
        || x.poDetailId - y.poDetailId);

    // Ringkasan per item PO: qty terpenuhi dan status sebelum/sesudah
    const touchedPos = new Set([...movableByPo.keys(), ...finalByPo.keys()]);
    const statusOf = (fulfilled, base) => (fulfilled >= base ? ALLOCATION_STATUS.CLOSED : ALLOCATION_STATUS.OPEN);
    const poSummary = [...touchedPos].map((poDetailId) => {
        const po = poById.get(poDetailId);
        const base = num(po.base_qty);
        const before = num(po.fulfilled_qty);
        const after = fulfilledAfterOf(poDetailId);
        return {
            poDetailId,
            poNumber: po.po_number,
            productCode: po.product_code,
            createdAt: po.created_at,
            baseQty: base,
            fulfilledBefore: before,
            fulfilledAfter: after,
            statusBefore: statusOf(before, base),
            statusAfter: statusOf(after, base)
        };
    }).filter((p) => p.fulfilledBefore !== p.fulfilledAfter || p.statusBefore !== p.statusAfter)
        .sort((x, y) => (x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0) || x.poDetailId - y.poDetailId);

    const reversalView = reversals.map((r) => ({
        ...r,
        poNumber: (poById.get(r.poDetailId) || {}).po_number || null,
        lotNumber: lotById.get(r.lotId).lot_number,
        batchNumber: batchById.get(r.batchId).batch_number
    }));

    return {
        productId,
        blockers,
        reversals: reversalView,
        changes,
        poSummary,
        canApply: blockers.length === 0 && changes.length > 0,
        noChange: blockers.length === 0 && changes.length === 0
    };
};

const computeRebalanceFingerprint = (calculation) => {
    const payload = {
        productId: calculation.productId,
        blockers: calculation.blockers,
        changes: calculation.changes.map((c) => [c.poDetailId, c.lotId, c.batchId, c.currentQty, c.qtyAfterReversal, c.finalQty]),
        reversals: calculation.reversals.map((r) => [r.allocationId, r.manualDelta])
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

module.exports = { calculateRebalance, computeRebalanceFingerprint, TRANS_TYPE };
