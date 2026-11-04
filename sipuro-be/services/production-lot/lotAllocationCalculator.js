/**
 * Automated FIFO Production Allocation Calculator Service (Lot-Centric)
 *
 * Fungsi murni (tanpa akses database). Dipakai SAMA PERSIS oleh preview dan commit,
 * sehingga hasil yang ditampilkan di preview identik dengan yang disimpan.
 *
 * Aturan utama:
 *  - Satuan alokasi adalah grup (batchNumber + lotNumber + itemCode). Total bersih grup 
 *    (plus dan minus dijumlahkan) harus teralokasi PENUH (boleh dipecah ke beberapa PO), 
 *    kalau tidak seluruh baris grup menjadi Unallocated.
 *  - Urutan grup: completed datetime ASC, batch number ASC, lot number ASC, urutan kemunculan di file.
 *  - Total bersih positif: FIFO berdasarkan po_headers.created_at (lalu po_detail_id), semua-atau-tidak.
 *    Urutan prioritas PO: (1) PO kode LAMA produk itu menurut pemetaan (leluhur bertingkat, produknya boleh
 *    nonaktif selama PO-nya aktif dan terbuka), (2) PO berkode sama. Bila gabungan keduanya belum cukup,
 *    dicoba juga PO produk sekeluarga lainnya yang AKTIF (nonaktif dilewati); leluhur tetap didahulukan.
 *  - Total bersih negatif: mengurangi alokasi (lot, batch) yang sama yang sudah ada, PO TERBARU lebih dulu.
 *  - Jenis transaksi berbasis LOT (issue sampel QC/RND, WIP Issue; daftar di tabel upload_trans_types): grupnya (lot, item)
 *    tanpa batch; mengurangi alokasi seluruh batch pada lot itu, PO TERBARU lebih dulu, lalu batch terbaru.
 *    Aturan semua-atau-tidak, batas qty terkirim, dan filter tanggal sama dengan retur.
 *  - Filter tanggal PO berlaku untuk mencocokkan completed date lot terhadap po_headers.created_at.
 *  - Grup tanpa nomor batch, tanpa nomor lot, atau tanpa tanggal selesai tidak dialokasikan
 *    dan menjadi Unallocated dengan alasan yang jelas (bukan menggagalkan commit).
 */
const crypto = require('crypto');
const { BusinessError } = require('../../helpers/businessError');
const { buildFamilyIndex } = require('../product-code-mapping/productFamilies');
const { buildStockCodeResolver } = require('../product-code-mapping/stockFamilyKey');
const {
    ALLOCATION_STATUS,
    PO_DETAIL_STATUS,
    ELIGIBLE_HEADER_STATUSES,
    ELIGIBLE_ALLOCATION_STATUSES,
    MATCH_BY,
    allocationKey,
    lotBatchKey,
    lotItemKey,
    lotKey
} = require('./lotAllocationRules');
const { stockKey } = require('../delivery-order/deliveryOrderRules');

const REASONS = {
    MISSING_DATE: 'Missing production date',
    MISSING_BATCH: 'Missing batch number',
    MISSING_LOT: 'Missing lot number',
    BATCH_CONFLICT: 'Batch number conflicts with another product',
    NET_ZERO: 'Net quantity is zero',
    NO_MATCHING_PO: 'No matching open PO',
    EXCEEDS_CAPACITY: 'Exceeds PO capacity',
    NO_EXISTING_ALLOCATION: 'No existing allocation to reduce',
    PO_NOT_ACTIVE: 'PO or PO detail not active',
    DATE_BEFORE_PO: 'Production date is earlier than PO creation date',
    REDUCTION_EXCEEDS: 'Reduction exceeds allocated quantity',
    BELOW_DELIVERED: 'Reduction would go below delivered quantity',
    CANNOT_ADD: 'This transaction type can only reduce allocations'
};

const pad = (n) => String(n).padStart(2, '0');

const toDateTimeString = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val.replace('T', ' ');
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const toDateOnly = (val) => {
    const s = toDateTimeString(val);
    return s ? s.split(' ')[0] : null;
};

const cmpNullLast = (a, b) => {
    const aNull = a === null || a === undefined;
    const bNull = b === null || b === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    if (a === b) return 0;
    return a < b ? -1 : 1;
};

// Kunci grup alokasi: satu kombinasi batch + lot + item
const groupKeyOf = (batchNumber, lotNumber, itemCode) => `${batchNumber}\u0000${lotNumber}\u0000${itemCode}`;
const groupKeyOfRow = (row) => (row.matchBy === MATCH_BY.LOT
    ? `LOT\u0000${lotItemKey(row.lotNumber, row.itemCode)}`
    : groupKeyOf(row.batchNumber, row.lotNumber, row.itemCode));

// Batch terbaru lebih dulu; batch yang baru dibuat oleh file ini (belum punya id) dianggap paling baru
const batchRank = (entry) => (entry.batchId === null || entry.batchId === undefined ? Infinity : Number(entry.batchId));
const cmpBatchNewestFirst = (x, y) => {
    const bx = batchRank(x);
    const by = batchRank(y);
    if (bx === by) return 0;
    return by > bx ? 1 : -1;
};

const cmpFifo = (a, b) => {
    const c = cmpNullLast(a.createdAt || '', b.createdAt || '');
    return c !== 0 ? c : a.poDetailId - b.poDetailId;
};

const calculateLotFifoAllocation = (
    rawRows = [],
    existingHashes = [],
    openPoDetails = [],
    allProducts = [],
    context = {}
) => {
    const existingBatches = context.existingBatches || [];
    const existingLots = context.existingLots || [];
    const existingAllocations = context.existingAllocations || [];
    const batchNumberById = new Map((context.allocationBatches || []).map((b) => [Number(b.id), b.batch_number]));
    (context.existingBatches || []).forEach((b) => batchNumberById.set(Number(b.id), b.batch_number));
    // Total alokasi dan qty terkirim per (kode produk lot, lot): alokasi tidak boleh turun di bawah qty terkirim
    const lotAllocated = context.lotAllocated || new Map();
    const lotDelivered = context.lotDelivered || new Map();
    const reducedInFile = new Map();
    // Alokasi tambahan dari grup lain di file yang sama (belum ada di lotAllocated dari database)
    const addedInFile = new Map();

    const productByCode = new Map();
    allProducts.forEach((p) => productByCode.set(p.product_code, p));
    const families = buildFamilyIndex(context.productMappings || []);
    // Stok lot dihitung per (keluarga produk, lot): kode lama dan pengganti yang dipetakan berbagi satu kunci
    const stockCodes = buildStockCodeResolver(allProducts, context.productMappings || []);
    const activeProductIds = new Set(allProducts.filter((p) => Number(p.is_active) === 1).map((p) => Number(p.id_product)));

    // 0. Blokir jika produk di file memiliki po_details dengan status 'Close Requested'
    const codesInFile = new Set();
    rawRows.forEach((r) => {
        if (productByCode.has(r.itemCode)) codesInFile.add(r.itemCode);
    });

    const blockedPos = openPoDetails.filter(
        (po) => po.detail_status === PO_DETAIL_STATUS.CLOSE_REQUESTED && codesInFile.has(po.product_code)
    );
    if (blockedPos.length > 0) {
        const list = [...new Set(blockedPos.map((po) => `${po.po_number} (${po.product_code})`))];
        throw new BusinessError(
            `Allocation process blocked. The following PO item(s) have a 'Close Requested' status: ${list.join(', ')}. Please complete the approval process first.`,
            409,
            { blockedPoItems: list }
        );
    }

    const hashSet = new Set(existingHashes);

    const categorizedDetails = {
        newRows: [],
        unallocatedRows: [],
        duplicateRows: [],
        duplicateStatusUpdateRows: [],
        unregisteredRows: [],
        nonGoodRows: []
    };

    // 1. Kategorisasi baris Excel
    const groups = new Map();
    const newRowsInFileOrder = [];

    const invalidQtyRows = [];

    rawRows.forEach((row, index) => {
        const isRegistered = productByCode.has(row.itemCode);
        // Qty desimal hanya ditolak untuk produk terdaftar (produk tidak terdaftar tidak disimpan).
        if (isRegistered && row.qtyIsWhole === false) {
            invalidQtyRows.push(`${row.excelRowNumber} ("${row.rawQtyText}")`);
        }
        // Hash lama (tanpa Doc Source) pada jenis lot-item tetap dikenali agar baris yang sudah tersimpan tidak masuk dua kali
        const isDuplicate = hashSet.has(row.rowHash) || Boolean(row.legacyRowHash && hashSet.has(row.legacyRowHash));
        const isLotGood = row.lotStatus && row.lotStatus.toUpperCase() === 'GOOD';

        if (!isRegistered) {
            row.rowStatusCategory = 'UNREGISTERED';
            categorizedDetails.unregisteredRows.push(row);
        } else if (isDuplicate) {
            if (!isLotGood) {
                row.rowStatusCategory = 'DUP_STATUS_UPDATE';
                row.previousLotStatus = 'GOOD';
                categorizedDetails.duplicateStatusUpdateRows.push(row);
            } else {
                row.rowStatusCategory = 'DUPLICATE';
                categorizedDetails.duplicateRows.push(row);
            }
        } else if (!isLotGood) {
            row.rowStatusCategory = 'NON_GOOD';
            categorizedDetails.nonGoodRows.push(row);
        } else {
            row.rowStatusCategory = 'NEW';
            newRowsInFileOrder.push(row);

            // Grouping key: Batch + Lot + Item; jenis berbasis lot: Lot + Item (tanpa batch)
            const matchBy = row.matchBy || MATCH_BY.BATCH_LOT;
            const key = groupKeyOfRow(row);
            let group = groups.get(key);
            if (!group) {
                group = {
                    key,
                    matchBy,
                    batchNumber: matchBy === MATCH_BY.LOT ? '' : row.batchNumber,
                    lotNumber: row.lotNumber,
                    itemCode: row.itemCode,
                    rows: [],
                    transTypes: [],
                    totalQty: 0,
                    completed: null,
                    expiredDate: row.expiredDate,
                    firstIndex: index,
                    missingDate: false
                };
                groups.set(key, group);
            }

            group.rows.push(row);
            if (row.transType && !group.transTypes.includes(row.transType)) group.transTypes.push(row.transType);
            group.totalQty += Number(row.rawAllocationQty) || 0;

            if (!row.actualCompletedDatetime) {
                group.missingDate = true;
            }
            if (row.actualCompletedDatetime && (group.completed === null || row.actualCompletedDatetime > group.completed)) {
                group.completed = row.actualCompletedDatetime;
            }
            if (!group.expiredDate && row.expiredDate) {
                group.expiredDate = row.expiredDate;
            }
        }
    });

    if (invalidQtyRows.length > 0) {
        const shown = invalidQtyRows.slice(0, 20).join(', ');
        const more = invalidQtyRows.length > 20 ? ` and ${invalidQtyRows.length - 20} more` : '';
        throw new BusinessError(
            `Quantity of a registered product must be a whole number. Please fix Excel row(s): ${shown}${more}.`,
            422
        );
    }

    // 2. Urutkan grup berdasarkan kronologi completed datetime ASC, batch, lot, kemunculan file
    // Pada waktu yang sama, grup berbasis batch diproses sebelum grup berbasis lot (issue)
    const kindRank = (g) => (g.matchBy === MATCH_BY.LOT ? 1 : 0);
    const sortedGroups = [...groups.values()].sort((a, b) => {
        return (
            cmpNullLast(a.completed, b.completed) ||
            kindRank(a) - kindRank(b) ||
            cmpNullLast(String(a.batchNumber), String(b.batchNumber)) ||
            cmpNullLast(String(a.lotNumber), String(b.lotNumber)) ||
            a.firstIndex - b.firstIndex
        );
    });

    const itemCodesByBatch = new Map();
    sortedGroups.forEach((g) => {
        // Grup tanpa nomor batch tidak ikut deteksi konflik (sudah ditolak dengan alasan sendiri);
        // grup berbasis lot memang tidak punya batch
        if (g.matchBy === MATCH_BY.LOT || !g.batchNumber) return;
        if (!itemCodesByBatch.has(g.batchNumber)) itemCodesByBatch.set(g.batchNumber, new Set());
        itemCodesByBatch.get(g.batchNumber).add(g.itemCode);
    });

    const batchByNumber = new Map();
    existingBatches.forEach((b) => batchByNumber.set(b.batch_number, b));

    const lotByKey = new Map();
    existingLots.forEach((l) => lotByKey.set(lotKey(l.lot_number, l.id_product), l));

    // 3. State PO
    const poStates = new Map();
    openPoDetails
        .filter((po) => po.detail_status === PO_DETAIL_STATUS.ACTIVE && ELIGIBLE_HEADER_STATUSES.includes(po.header_status))
        .forEach((po) => {
            const baseQty = Number(po.base_qty) || 0;
            poStates.set(po.po_detail_id, {
                poDetailId: po.po_detail_id,
                poHeaderId: po.po_header_id,
                poNumber: po.po_number,
                idProduct: po.id_product,
                productCode: po.product_code,
                productName: po.product_name,
                createdAt: toDateTimeString(po.created_at),
                createdDate: toDateOnly(po.created_at),
                baseQty,
                currentFulfilledQty: Number(po.fulfilled_qty) || 0
            });
        });

    // State alokasi: per (item PO, lot, batch) dan dikelompokkan per (lot, batch)
    const allocByKey = new Map();
    const allocsByLotBatch = new Map();
    // Seluruh alokasi per lot (nomor lot + produk), termasuk yang baru dibuat grup lain di file ini:
    // jenis berbasis lot mengurangi lintas batch dan harus melihat keduanya.
    const entriesByLot = new Map();
    const lotById = new Map(existingLots.map((l) => [Number(l.id), l]));
    existingAllocations.forEach((a) => {
        const entry = {
            poDetailId: a.po_detail_id,
            lotId: a.lot_id,
            batchId: a.id_batch,
            batchNumber: batchNumberById.get(Number(a.id_batch)) || '',
            allocatedQty: Number(a.allocated_qty) || 0,
            status: a.status
        };
        allocByKey.set(allocationKey(a.po_detail_id, a.lot_id, a.id_batch), entry);
        const groupKey = lotBatchKey(a.lot_id, a.id_batch);
        if (!allocsByLotBatch.has(groupKey)) allocsByLotBatch.set(groupKey, []);
        allocsByLotBatch.get(groupKey).push(entry);
        const lotRow = lotById.get(Number(a.lot_id));
        if (lotRow) {
            const lotEntryKey = lotKey(lotRow.lot_number, lotRow.id_product);
            if (!entriesByLot.has(lotEntryKey)) entriesByLot.set(lotEntryKey, []);
            entriesByLot.get(lotEntryKey).push(entry);
        }
    });

    const allocatedGroups = [];
    const unallocatedGroups = [];

    const passesDateFilter = (po, completedDate) => {
        if (!po.createdDate) return true;
        if (completedDate && completedDate < po.createdDate) return false;
        return true;
    };

    // 4. Proses tiap grup
    sortedGroups.forEach((group) => {
        const product = productByCode.get(group.itemCode);
        const fail = (reason) => unallocatedGroups.push({ group, reason });
        const lotOnly = group.matchBy === MATCH_BY.LOT;

        if (!lotOnly && !group.batchNumber) return fail(REASONS.MISSING_BATCH);
        if (!group.lotNumber) return fail(REASONS.MISSING_LOT);
        if (group.missingDate) return fail(REASONS.MISSING_DATE);

        const existingBatch = lotOnly ? null : (batchByNumber.get(group.batchNumber) || null);
        const existingLot = lotByKey.get(lotKey(group.lotNumber, product.id_product)) || null;

        const conflictInFile = !lotOnly && itemCodesByBatch.get(group.batchNumber).size > 1;
        const conflictInDb = existingBatch && Number(existingBatch.id_product) !== Number(product.id_product);
        if (conflictInFile || conflictInDb) return fail(REASONS.BATCH_CONFLICT);

        if (group.totalQty === 0) return fail(REASONS.NET_ZERO);

        const lotDbId = existingLot ? existingLot.id : null;
        const batchDbId = existingBatch ? existingBatch.id : null;
        // Alokasi lama hanya mungkin ada bila lot dan batch-nya sudah tersimpan (jenis berbasis lot: cukup lot-nya)
        const hasStoredPair = lotDbId !== null && batchDbId !== null;
        const completedDate = toDateOnly(group.completed);

        // Jenis berbasis lot hanya boleh mengurangi (dijaga oleh daftar jenis transaksi)
        if (group.totalQty > 0 && lotOnly) return fail(REASONS.CANNOT_ADD);

        if (group.totalQty > 0) {
            // ---------- PLUS: alokasi FIFO ----------
            const ancestorIds = new Set(families.ancestorsOf(product.id_product));
            const isAncestorPo = (po) => ancestorIds.has(Number(po.idProduct));
            const capacityOf = (list) => list.reduce((sum, po) => sum + Math.max(po.baseQty - po.currentFulfilledQty, 0), 0);

            // Rencana alokasi untuk satu himpunan PO; tidak mengubah state sebelum berhasil.
            // PO kode lama (leluhur) selalu didahulukan, lalu FIFO.
            const planPlus = (poFilter) => {
                const eligible = [...poStates.values()]
                    .filter(poFilter)
                    .filter((po) => {
                        if (!hasStoredPair) return true;
                        const existing = allocByKey.get(allocationKey(po.poDetailId, lotDbId, batchDbId));
                        return !existing || ELIGIBLE_ALLOCATION_STATUSES.includes(existing.status);
                    });
                if (eligible.length === 0) return { reason: REASONS.NO_MATCHING_PO };

                const candidates = eligible
                    .filter((po) => passesDateFilter(po, completedDate))
                    .sort((a, b) => (isAncestorPo(b) - isAncestorPo(a)) || cmpFifo(a, b));

                // Aturan: Jika kapasitas total tidak mencukupi, seluruh baris grup masuk unallocated (tidak diparuh paksa)
                if (capacityOf(candidates) < group.totalQty) {
                    // Cukup bila PO yang lebih baru dari tanggal produksi ikut dihitung: penyebabnya tanggal.
                    return { reason: capacityOf(eligible) >= group.totalQty ? REASONS.DATE_BEFORE_PO : REASONS.EXCEEDS_CAPACITY };
                }
                return { withCapacity: candidates.filter((po) => po.baseQty - po.currentFulfilledQty > 0) };
            };

            // 1) PO kode lama + PO kode sendiri (kode lama dahulu)
            let plan = planPlus((po) => po.productCode === group.itemCode || isAncestorPo(po));
            if (plan.reason) {
                // 2) Sebelum Unallocated: tambahkan PO produk sekeluarga lainnya yang AKTIF.
                // Alasan yang dilaporkan berasal dari pencarian terluas yang dicoba.
                const family = families.familyOf(product.id_product);
                if (family.length > 1) {
                    plan = planPlus((po) => po.productCode === group.itemCode
                        || isAncestorPo(po)
                        || (family.includes(Number(po.idProduct)) && activeProductIds.has(Number(po.idProduct))));
                }
            }
            if (plan.reason) return fail(plan.reason);
            const { withCapacity } = plan;

            let remaining = group.totalQty;
            const allocations = [];
            for (const po of withCapacity) {
                if (remaining <= 0) break;
                const need = po.baseQty - po.currentFulfilledQty;
                const take = Math.min(remaining, need);
                if (take <= 0) continue;

                const previous = po.currentFulfilledQty;
                po.currentFulfilledQty = previous + take;
                allocations.push({ po, delta: take, previous, next: po.currentFulfilledQty });
                remaining -= take;

                // Kunci memakai kode produk lot (sama dengan Delivery Order), walau PO berkode lain lewat pemetaan
                const stockId = stockKey(stockCodes.forProductCode(group.itemCode), group.lotNumber);
                addedInFile.set(stockId, (addedInFile.get(stockId) || 0) + take);

                const existing = hasStoredPair
                    ? allocByKey.get(allocationKey(po.poDetailId, lotDbId, batchDbId))
                    : undefined;
                if (existing) {
                    existing.allocatedQty += take;
                } else {
                    // Alokasi baru dari file ini: dicatat agar grup berbasis lot di file yang sama bisa menguranginya
                    const lotEntryKey = lotKey(group.lotNumber, product.id_product);
                    if (!entriesByLot.has(lotEntryKey)) entriesByLot.set(lotEntryKey, []);
                    entriesByLot.get(lotEntryKey).push({
                        poDetailId: po.poDetailId,
                        lotId: lotDbId,
                        batchId: batchDbId,
                        batchNumber: group.batchNumber,
                        allocatedQty: take,
                        status: ALLOCATION_STATUS.OPEN
                    });
                }
            }

            allocatedGroups.push({ group, product, allocations });
            return;
        }

        // ---------- MINUS: kurangi alokasi lot yang sudah ada ----------
        const amount = -group.totalQty;
        if (!lotOnly && !hasStoredPair) return fail(REASONS.NO_EXISTING_ALLOCATION);

        // Retur hanya mengurangi alokasi pada pasangan (lot, batch) yang sama;
        // jenis berbasis lot mengurangi alokasi seluruh batch pada lot itu
        const scopedEntries = lotOnly
            ? (entriesByLot.get(lotKey(group.lotNumber, product.id_product)) || [])
            : (allocsByLotBatch.get(lotBatchKey(lotDbId, batchDbId)) || []);
        const eligibleEntries = scopedEntries.filter((e) =>
            ELIGIBLE_ALLOCATION_STATUSES.includes(e.status)
        );
        if (eligibleEntries.length === 0) return fail(REASONS.NO_EXISTING_ALLOCATION);

        const withActivePo = eligibleEntries.filter((e) => {
            // Lot sudah menentukan produknya; PO boleh berkode lain (alokasi lewat pemetaan kode produk)
            return Boolean(poStates.get(e.poDetailId));
        });
        if (withActivePo.length === 0) return fail(REASONS.PO_NOT_ACTIVE);

        const withDate = withActivePo.filter((e) =>
            passesDateFilter(poStates.get(e.poDetailId), completedDate)
        );
        if (withDate.length === 0) return fail(REASONS.DATE_BEFORE_PO);

        const totalReducible = withDate.reduce((sum, e) => sum + e.allocatedQty, 0);
        if (totalReducible < amount) return fail(REASONS.REDUCTION_EXCEEDS);

        // Sisa yang boleh dikurangi per (kode produk lot, lot) = total alokasi - terkirim - sudah dikurangi di file ini.
        // Kunci memakai kode produksi (group.itemCode), sama dengan Delivery Order, walau PO berkode lain (via pemetaan).
        const roomByKey = new Map();
        const keyOfEntry = () => stockKey(stockCodes.forProductCode(group.itemCode), group.lotNumber);
        const roomOf = (key) => {
            if (!roomByKey.has(key)) {
                const delivered = Number(lotDelivered.get(key)) || 0;
                // Tanpa pengiriman tidak ada batas tambahan
                const room = delivered > 0
                    ? (Number(lotAllocated.get(key)) || 0) + (addedInFile.get(key) || 0) - delivered - (reducedInFile.get(key) || 0)
                    : Infinity;
                roomByKey.set(key, Math.max(0, room));
            }
            return roomByKey.get(key);
        };

        // PO terbaru lebih dulu; pada PO yang sama (lintas batch) batch terbaru (id terbesar) lebih dulu
        const ordered = [...withDate].sort((x, y) =>
            cmpFifo(poStates.get(y.poDetailId), poStates.get(x.poDetailId)) || cmpBatchNewestFirst(x, y)
        );

        // Rencana dahulu; state baru diubah setelah seluruh pengurangan terbukti muat
        const plan = [];
        let remaining = amount;
        for (const entry of ordered) {
            if (remaining <= 0) break;
            const key = keyOfEntry(entry);
            const take = Math.min(remaining, entry.allocatedQty, roomOf(key));
            if (take <= 0) continue;
            roomByKey.set(key, roomOf(key) - take);
            plan.push({ entry, key, take });
            remaining -= take;
        }
        if (remaining > 0) return fail(REASONS.BELOW_DELIVERED);

        const allocations = [];
        plan.forEach(({ entry, key, take }) => {
            const po = poStates.get(entry.poDetailId);
            const previous = po.currentFulfilledQty;
            po.currentFulfilledQty = previous - take;
            entry.allocatedQty -= take;
            reducedInFile.set(key, (reducedInFile.get(key) || 0) + take);
            allocations.push({
                po,
                delta: -take,
                previous,
                next: po.currentFulfilledQty,
                // Batch alokasi yang dikurangi (jenis berbasis lot: batch dari alokasi itu sendiri)
                batchId: entry.batchId,
                batchNumber: lotOnly ? entry.batchNumber : group.batchNumber
            });
        });

        allocatedGroups.push({ group, product, allocations });
    });

    const finalStatusOf = (po) => (po.currentFulfilledQty >= po.baseQty ? ALLOCATION_STATUS.CLOSED : ALLOCATION_STATUS.OPEN);

    const previewResults = [];
    const detailedAllocations = [];
    const allocatedKeys = new Set();

    allocatedGroups.forEach(({ group, product, allocations }) => {
        allocatedKeys.add(group.key);

        const allocationItems = allocations.map(({ po, delta, previous, next, batchId, batchNumber }) => {
            const status = finalStatusOf(po);
            const ratio = po.baseQty > 0 ? next / po.baseQty : 0;

            detailedAllocations.push({
                poDetailId: po.poDetailId,
                batchNumber: batchNumber === undefined ? group.batchNumber : batchNumber,
                batchId: batchId || null,
                lotNumber: group.lotNumber,
                productCode: group.itemCode,
                idProduct: product.id_product,
                productName: product.product_name,
                poProductCode: po.productCode,
                viaMapping: po.productCode !== group.itemCode,
                fulfilledQty: next,
                addedQty: delta,
                rowStatus: status,
                transType: group.transTypes.join(', '),
                actualCompletedDatetime: group.completed,
                expiredDate: group.expiredDate,
                actDate: group.completed ? group.completed.split(' ')[0] : null
            });

            return {
                poDetailId: po.poDetailId,
                batchNumber: batchNumber === undefined ? group.batchNumber : batchNumber,
                poNumber: po.poNumber,
                poProductCode: po.productCode,
                viaMapping: po.productCode !== group.itemCode,
                poQty: po.baseQty,
                previousFulfilledQty: previous,
                addedQty: delta,
                newFulfilledQty: next,
                fulfillmentPercentage: (ratio * 100).toFixed(1),
                status
            };
        });

        // Format Actual Date gabungan: Completed & Expired Date
        const completedStr = group.completed || '-';
        const expiredStr = group.expiredDate || '-';
        const formattedActualDate = `Completed: ${completedStr} | Exp: ${expiredStr}`;

        previewResults.push({
            lotOnly: group.matchBy === MATCH_BY.LOT,
            transType: group.transTypes.join(', '),
            batchNumber: group.batchNumber,
            lotNumber: group.lotNumber,
            productCode: group.itemCode,
            idProduct: product.id_product,
            productName: product.product_name,
            actualCompletedDatetime: group.completed,
            expiredDate: group.expiredDate,
            formattedActualDate,
            totalQtyOutput: group.totalQty,
            rowCount: group.rows.length,
            allocations: allocationItems
        });
    });

    categorizedDetails.newRows = newRowsInFileOrder.filter((r) =>
        allocatedKeys.has(groupKeyOfRow(r))
    );

    // Baris unallocated & kategori lain dengan atribut lengkap untuk tabel preview
    unallocatedGroups.forEach(({ group, reason }) => {
        group.rows.forEach((row) => {
            categorizedDetails.unallocatedRows.push({
                ...row,
                rowStatusCategory: 'UNALLOCATED',
                reason
            });
        });
    });
    categorizedDetails.unallocatedRows.sort(
        (a, b) => (a.excelRowNumber || 0) - (b.excelRowNumber || 0)
    );

    return {
        categorizedDetails,
        newRows: categorizedDetails.newRows,
        unallocatedRows: categorizedDetails.unallocatedRows,
        duplicateRows: categorizedDetails.duplicateRows,
        duplicateStatusUpdateRows: categorizedDetails.duplicateStatusUpdateRows,
        unregisteredRows: categorizedDetails.unregisteredRows,
        nonGoodRows: categorizedDetails.nonGoodRows,
        summary: {
            totalRows: rawRows.length,
            newCount: previewResults.length,
            validRowCount: categorizedDetails.newRows.length,
            unallocatedCount: categorizedDetails.unallocatedRows.length,
            duplicateCount: categorizedDetails.duplicateRows.length,
            duplicateStatusUpdateCount: categorizedDetails.duplicateStatusUpdateRows.length,
            unregisteredCount: categorizedDetails.unregisteredRows.length,
            nonGoodCount: categorizedDetails.nonGoodRows.length
        },
        canSave: previewResults.length > 0,
        previewResults,
        detailedAllocations
    };
};

const computeAllocationFingerprint = (calculation) => {
    const payload = {
        rows: calculation.newRows.map((r) => r.rowHash),
        batches: calculation.previewResults.map((b) => ({
            batch: b.batchNumber,
            lot: b.lotNumber,
            product: b.productCode,
            total: b.totalQtyOutput,
            allocations: b.allocations.map((a) => [
                a.poDetailId,
                a.addedQty,
                a.previousFulfilledQty,
                a.newFulfilledQty,
                a.status,
                // Batch yang dikurangi ikut menentukan hasil bila jenisnya berbasis lot
                ...(b.lotOnly ? [a.batchNumber] : [])
            ])
        }))
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

module.exports = {
    calculateLotFifoAllocation,
    computeAllocationFingerprint,
    REASONS
};
