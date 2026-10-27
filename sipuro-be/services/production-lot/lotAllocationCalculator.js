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
 *  - Total bersih positif: FIFO berdasarkan po_headers.created_at (lalu po_detail_id).
 *  - Total bersih negatif: mengurangi alokasi (lot, batch) yang sama yang sudah ada, PO TERBARU lebih dulu.
 *  - Filter tanggal PO berlaku untuk mencocokkan completed date lot terhadap po_headers.created_at.
 *  - Grup tanpa nomor batch, tanpa nomor lot, atau tanpa tanggal selesai tidak dialokasikan
 *    dan menjadi Unallocated dengan alasan yang jelas (bukan menggagalkan commit).
 */
const crypto = require('crypto');
const { BusinessError } = require('../../helpers/businessError');
const {
    ALLOCATION_STATUS,
    PO_DETAIL_STATUS,
    ELIGIBLE_HEADER_STATUSES,
    ELIGIBLE_ALLOCATION_STATUSES,
    allocationKey,
    lotBatchKey,
    lotKey
} = require('./lotAllocationRules');

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
    REDUCTION_EXCEEDS: 'Reduction exceeds allocated quantity'
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

    const productByCode = new Map();
    allProducts.forEach((p) => productByCode.set(p.product_code, p));

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
        const isDuplicate = hashSet.has(row.rowHash);
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

            // Grouping key berbasis Batch + Lot + Item
            const key = groupKeyOf(row.batchNumber, row.lotNumber, row.itemCode);
            let group = groups.get(key);
            if (!group) {
                group = {
                    key,
                    batchNumber: row.batchNumber,
                    lotNumber: row.lotNumber,
                    itemCode: row.itemCode,
                    rows: [],
                    totalQty: 0,
                    completed: null,
                    expiredDate: row.expiredDate,
                    firstIndex: index,
                    missingDate: false
                };
                groups.set(key, group);
            }

            group.rows.push(row);
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
    const sortedGroups = [...groups.values()].sort((a, b) => {
        return (
            cmpNullLast(a.completed, b.completed) ||
            cmpNullLast(String(a.batchNumber), String(b.batchNumber)) ||
            cmpNullLast(String(a.lotNumber), String(b.lotNumber)) ||
            a.firstIndex - b.firstIndex
        );
    });

    const itemCodesByBatch = new Map();
    sortedGroups.forEach((g) => {
        // Grup tanpa nomor batch tidak ikut deteksi konflik (sudah ditolak dengan alasan sendiri)
        if (!g.batchNumber) return;
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
    existingAllocations.forEach((a) => {
        const entry = {
            poDetailId: a.po_detail_id,
            lotId: a.lot_id,
            batchId: a.id_batch,
            allocatedQty: Number(a.allocated_qty) || 0,
            status: a.status
        };
        allocByKey.set(allocationKey(a.po_detail_id, a.lot_id, a.id_batch), entry);
        const groupKey = lotBatchKey(a.lot_id, a.id_batch);
        if (!allocsByLotBatch.has(groupKey)) allocsByLotBatch.set(groupKey, []);
        allocsByLotBatch.get(groupKey).push(entry);
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

        if (!group.batchNumber) return fail(REASONS.MISSING_BATCH);
        if (!group.lotNumber) return fail(REASONS.MISSING_LOT);
        if (group.missingDate) return fail(REASONS.MISSING_DATE);

        const existingBatch = batchByNumber.get(group.batchNumber) || null;
        const existingLot = lotByKey.get(lotKey(group.lotNumber, product.id_product)) || null;

        const conflictInFile = itemCodesByBatch.get(group.batchNumber).size > 1;
        const conflictInDb = existingBatch && Number(existingBatch.id_product) !== Number(product.id_product);
        if (conflictInFile || conflictInDb) return fail(REASONS.BATCH_CONFLICT);

        if (group.totalQty === 0) return fail(REASONS.NET_ZERO);

        const lotDbId = existingLot ? existingLot.id : null;
        const batchDbId = existingBatch ? existingBatch.id : null;
        // Alokasi lama hanya mungkin ada bila lot dan batch-nya sudah tersimpan
        const hasStoredPair = lotDbId !== null && batchDbId !== null;
        const completedDate = toDateOnly(group.completed);

        if (group.totalQty > 0) {
            // ---------- PLUS: alokasi FIFO ----------
            const candidates = [...poStates.values()]
                .filter((po) => po.productCode === group.itemCode)
                .filter((po) => passesDateFilter(po, completedDate))
                .filter((po) => {
                    if (!hasStoredPair) return true;
                    const existing = allocByKey.get(allocationKey(po.poDetailId, lotDbId, batchDbId));
                    return !existing || ELIGIBLE_ALLOCATION_STATUSES.includes(existing.status);
                })
                .sort(cmpFifo);

            if (candidates.length === 0) return fail(REASONS.NO_MATCHING_PO);

            const withCapacity = candidates.filter((po) => po.baseQty - po.currentFulfilledQty > 0);
            const totalCapacity = withCapacity.reduce((sum, po) => sum + (po.baseQty - po.currentFulfilledQty), 0);

            // Aturan: Jika kapasitas total tidak mencukupi, seluruh baris grup masuk unallocated (tidak diparuh paksa)
            if (totalCapacity < group.totalQty) return fail(REASONS.EXCEEDS_CAPACITY);

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

                if (hasStoredPair) {
                    const existing = allocByKey.get(allocationKey(po.poDetailId, lotDbId, batchDbId));
                    if (existing) existing.allocatedQty += take;
                }
            }

            allocatedGroups.push({ group, product, allocations });
            return;
        }

        // ---------- MINUS: kurangi alokasi lot yang sudah ada ----------
        const amount = -group.totalQty;
        if (!hasStoredPair) return fail(REASONS.NO_EXISTING_ALLOCATION);

        // Retur hanya mengurangi alokasi pada pasangan (lot, batch) yang sama
        const eligibleEntries = (allocsByLotBatch.get(lotBatchKey(lotDbId, batchDbId)) || []).filter((e) =>
            ELIGIBLE_ALLOCATION_STATUSES.includes(e.status)
        );
        if (eligibleEntries.length === 0) return fail(REASONS.NO_EXISTING_ALLOCATION);

        const withActivePo = eligibleEntries.filter((e) => {
            const po = poStates.get(e.poDetailId);
            return po && po.productCode === group.itemCode;
        });
        if (withActivePo.length === 0) return fail(REASONS.PO_NOT_ACTIVE);

        const withDate = withActivePo.filter((e) =>
            passesDateFilter(poStates.get(e.poDetailId), completedDate)
        );
        if (withDate.length === 0) return fail(REASONS.DATE_BEFORE_PO);

        const totalReducible = withDate.reduce((sum, e) => sum + e.allocatedQty, 0);
        if (totalReducible < amount) return fail(REASONS.REDUCTION_EXCEEDS);

        const ordered = [...withDate].sort((x, y) => cmpFifo(poStates.get(y.poDetailId), poStates.get(x.poDetailId)));

        let remaining = amount;
        const allocations = [];
        for (const entry of ordered) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, entry.allocatedQty);
            if (take <= 0) continue;

            const po = poStates.get(entry.poDetailId);
            const previous = po.currentFulfilledQty;
            po.currentFulfilledQty = previous - take;
            entry.allocatedQty -= take;
            allocations.push({ po, delta: -take, previous, next: po.currentFulfilledQty });
            remaining -= take;
        }

        allocatedGroups.push({ group, product, allocations });
    });

    const finalStatusOf = (po) => (po.currentFulfilledQty >= po.baseQty ? ALLOCATION_STATUS.CLOSED : ALLOCATION_STATUS.OPEN);

    const previewResults = [];
    const detailedAllocations = [];
    const allocatedKeys = new Set();

    allocatedGroups.forEach(({ group, product, allocations }) => {
        allocatedKeys.add(group.key);

        const allocationItems = allocations.map(({ po, delta, previous, next }) => {
            const status = finalStatusOf(po);
            const ratio = po.baseQty > 0 ? next / po.baseQty : 0;

            detailedAllocations.push({
                poDetailId: po.poDetailId,
                batchNumber: group.batchNumber,
                lotNumber: group.lotNumber,
                productCode: group.itemCode,
                idProduct: product.id_product,
                productName: product.product_name,
                fulfilledQty: next,
                addedQty: delta,
                rowStatus: status,
                actualCompletedDatetime: group.completed,
                expiredDate: group.expiredDate,
                actDate: group.completed ? group.completed.split(' ')[0] : null
            });

            return {
                poDetailId: po.poDetailId,
                poNumber: po.poNumber,
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
        allocatedKeys.has(groupKeyOf(r.batchNumber, r.lotNumber, r.itemCode))
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
                a.status
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
