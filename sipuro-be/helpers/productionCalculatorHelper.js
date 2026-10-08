/**
 * Automated FIFO Production Allocation Calculator Service
 *
 * Fungsi murni (tanpa akses database). Dipakai SAMA PERSIS oleh preview dan commit,
 * sehingga hasil yang ditampilkan di preview identik dengan yang disimpan.
 *
 * Aturan utama:
 *  - Satuan alokasi adalah grup (batchNumber + itemCode). Total bersih grup (plus dan minus dijumlahkan)
 *    harus teralokasi PENUH (boleh dipecah ke beberapa PO), kalau tidak seluruh baris grup menjadi Unallocated.
 *  - Urutan grup: start datetime ASC, completed datetime ASC, batch number ASC, urutan kemunculan di file.
 *  - Grup yang gagal tidak menghentikan grup berikutnya.
 *  - Total bersih positif: FIFO berdasarkan po_headers.created_at (lalu po_detail_id).
 *  - Total bersih negatif: mengurangi alokasi batch yang sudah ada, PO TERBARU lebih dulu.
 *  - Filter tanggal PO berlaku untuk plus dan minus.
 */
const crypto = require('crypto');
const { BusinessError } = require('./businessError');

const ELIGIBLE_HEADER_STATUSES = ['Approved', 'Production Completed'];
const ELIGIBLE_ALLOCATION_STATUSES = ['Open', 'Closed'];

const REASONS = {
    MISSING_DATE: 'Missing production date',
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

/**
 * Normalisasi nilai tanggal ke string 'YYYY-MM-DD HH:mm:ss'.
 * String dipakai apa adanya (tidak ada konversi timezone). Date memakai komponen lokal (hanya untuk tes/fallback).
 */
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

// Pembanding string dengan null di akhir (urutan kode-poin, tidak tergantung locale server)
const cmpNullLast = (a, b) => {
    const aNull = a === null || a === undefined;
    const bNull = b === null || b === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    if (a === b) return 0;
    return a < b ? -1 : 1;
};

const cmpFifo = (a, b) => {
    const c = cmpNullLast(a.createdAt || '', b.createdAt || '');
    return c !== 0 ? c : a.poDetailId - b.poDetailId;
};

const calculateFifoAllocation = (
    rawRows = [],
    existingHashes = [],
    openPoDetails = [],
    allProducts = [],
    context = {}
) => {
    const existingBatches = context.existingBatches || [];
    const existingAllocations = context.existingAllocations || [];

    const productByCode = new Map();
    allProducts.forEach((p) => productByCode.set(p.product_code, p));

    // 0. Blokir hanya jika PRODUK YANG ADA DI FILE memiliki po_details 'Close Requested'
    const codesInFile = new Set();
    rawRows.forEach((r) => {
        if (productByCode.has(r.itemCode)) codesInFile.add(r.itemCode);
    });

    const blockedPos = openPoDetails.filter(
        (po) => po.detail_status === 'Close Requested' && codesInFile.has(po.product_code)
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

    rawRows.forEach((row, index) => {
        const isRegistered = productByCode.has(row.itemCode);
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

            const key = `${row.batchNumber}\u0000${row.itemCode}`;
            let group = groups.get(key);
            if (!group) {
                group = {
                    key,
                    batchNumber: row.batchNumber,
                    itemCode: row.itemCode,
                    rows: [],
                    totalQty: 0,
                    start: null,
                    completed: null,
                    firstIndex: index,
                    missingDate: false
                };
                groups.set(key, group);
            }

            group.rows.push(row);
            group.totalQty += Number(row.qtyPac) || 0;

            if (!row.actualStartDatetime || !row.actualCompletedDatetime) {
                group.missingDate = true;
            }
            if (row.actualStartDatetime && (group.start === null || row.actualStartDatetime < group.start)) {
                group.start = row.actualStartDatetime;
            }
            if (row.actualCompletedDatetime && (group.completed === null || row.actualCompletedDatetime > group.completed)) {
                group.completed = row.actualCompletedDatetime;
            }
        }
    });

    // 2. Urutkan grup
    const sortedGroups = [...groups.values()].sort((a, b) => {
        return (
            cmpNullLast(a.start, b.start) ||
            cmpNullLast(a.completed, b.completed) ||
            cmpNullLast(String(a.batchNumber), String(b.batchNumber)) ||
            a.firstIndex - b.firstIndex
        );
    });

    // Nomor batch yang muncul dengan lebih dari satu item code dalam file ini
    const itemCodesByBatch = new Map();
    sortedGroups.forEach((g) => {
        if (!itemCodesByBatch.has(g.batchNumber)) itemCodesByBatch.set(g.batchNumber, new Set());
        itemCodesByBatch.get(g.batchNumber).add(g.itemCode);
    });

    const batchByNumber = new Map();
    existingBatches.forEach((b) => batchByNumber.set(b.batch_number, b));

    // 3. State PO (hanya header Approved/Production Completed dan detail Active)
    const poStates = new Map();
    openPoDetails
        .filter((po) => po.detail_status === 'Active' && ELIGIBLE_HEADER_STATUSES.includes(po.header_status))
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

    // State alokasi yang sudah ada: per pasangan (po_detail_id, id_batch) dan per batch
    const allocByPair = new Map();
    const allocsByBatch = new Map();
    existingAllocations.forEach((a) => {
        const entry = {
            poDetailId: a.po_detail_id,
            batchId: a.id_batch,
            allocatedQty: Number(a.allocated_qty) || 0,
            status: a.status
        };
        allocByPair.set(`${a.po_detail_id}_${a.id_batch}`, entry);
        if (!allocsByBatch.has(a.id_batch)) allocsByBatch.set(a.id_batch, []);
        allocsByBatch.get(a.id_batch).push(entry);
    });

    const allocatedGroups = []; // { group, product, allocations: [{po, delta, previous, next}] }
    const unallocatedGroups = []; // { group, reason }

    const passesDateFilter = (po, startDate, completedDate) => {
        if (!po.createdDate) return true;
        if (startDate && startDate < po.createdDate) return false;
        if (completedDate && completedDate < po.createdDate) return false;
        return true;
    };

    // 4. Proses tiap grup
    sortedGroups.forEach((group) => {
        const product = productByCode.get(group.itemCode);
        const fail = (reason) => unallocatedGroups.push({ group, reason });

        if (group.missingDate) return fail(REASONS.MISSING_DATE);

        const existingBatch = batchByNumber.get(group.batchNumber) || null;
        const conflictInFile = itemCodesByBatch.get(group.batchNumber).size > 1;
        const conflictInDb = existingBatch && Number(existingBatch.id_product) !== Number(product.id_product);
        if (conflictInFile || conflictInDb) return fail(REASONS.BATCH_CONFLICT);

        if (group.totalQty === 0) return fail(REASONS.NET_ZERO);

        const batchDbId = existingBatch ? existingBatch.id : null;
        const startDate = toDateOnly(group.start);
        const completedDate = toDateOnly(group.completed);

        if (group.totalQty > 0) {
            // ---------- PLUS: alokasi FIFO ----------
            const candidates = [...poStates.values()]
                .filter((po) => po.productCode === group.itemCode)
                .filter((po) => passesDateFilter(po, startDate, completedDate))
                .filter((po) => {
                    if (batchDbId === null) return true;
                    const existing = allocByPair.get(`${po.poDetailId}_${batchDbId}`);
                    return !existing || ELIGIBLE_ALLOCATION_STATUSES.includes(existing.status);
                })
                .sort(cmpFifo);

            if (candidates.length === 0) return fail(REASONS.NO_MATCHING_PO);

            const withCapacity = candidates.filter((po) => po.baseQty - po.currentFulfilledQty > 0);
            const totalCapacity = withCapacity.reduce((sum, po) => sum + (po.baseQty - po.currentFulfilledQty), 0);
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

                if (batchDbId !== null) {
                    const key = `${po.poDetailId}_${batchDbId}`;
                    const existing = allocByPair.get(key);
                    if (existing) existing.allocatedQty += take;
                }
            }

            allocatedGroups.push({ group, product, allocations });
            return;
        }

        // ---------- MINUS: kurangi alokasi yang sudah ada, PO terbaru dulu ----------
        const amount = -group.totalQty;
        if (batchDbId === null) return fail(REASONS.NO_EXISTING_ALLOCATION);

        const eligibleEntries = (allocsByBatch.get(batchDbId) || []).filter((e) =>
            ELIGIBLE_ALLOCATION_STATUSES.includes(e.status)
        );
        if (eligibleEntries.length === 0) return fail(REASONS.NO_EXISTING_ALLOCATION);

        const withActivePo = eligibleEntries.filter((e) => {
            const po = poStates.get(e.poDetailId);
            return po && po.productCode === group.itemCode;
        });
        if (withActivePo.length === 0) return fail(REASONS.PO_NOT_ACTIVE);

        const withDate = withActivePo.filter((e) =>
            passesDateFilter(poStates.get(e.poDetailId), startDate, completedDate)
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

    // 5. Susun keluaran (status akhir = status PO setelah seluruh FIFO selesai)
    const finalStatusOf = (po) => (po.currentFulfilledQty >= po.baseQty ? 'Closed' : 'Open');

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
                productCode: group.itemCode,
                idProduct: product.id_product,
                productName: product.product_name,
                fulfilledQty: next,
                addedQty: delta,
                rowStatus: status,
                actualStartDatetime: group.start,
                actualCompletedDatetime: group.completed,
                actDate: group.start ? group.start.split(' ')[0] : null
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

        previewResults.push({
            batchNumber: group.batchNumber,
            productCode: group.itemCode,
            idProduct: product.id_product,
            productName: product.product_name,
            actualStartDatetime: group.start,
            actualCompletedDatetime: group.completed,
            totalQtyOutput: group.totalQty,
            rowCount: group.rows.length,
            allocations: allocationItems
        });
    });

    // Baris yang akan disimpan = baris dari grup yang teralokasi (urutan file)
    categorizedDetails.newRows = newRowsInFileOrder.filter((r) =>
        allocatedKeys.has(`${r.batchNumber}\u0000${r.itemCode}`)
    );

    // Baris Unallocated = baris asli Excel + alasan
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
            newCount: previewResults.length, // jumlah batch yang teralokasi
            validRowCount: categorizedDetails.newRows.length, // jumlah baris Excel di balik batch tersebut
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

/**
 * Sidik jari hasil alokasi. Preview mengirimnya ke client, commit menghitung ulang dan membandingkan.
 * Jika berbeda (PO berubah di antara preview dan commit), commit ditolak.
 */
const computeAllocationFingerprint = (calculation) => {
    const payload = {
        rows: calculation.newRows.map((r) => r.rowHash),
        batches: calculation.previewResults.map((b) => ({
            batch: b.batchNumber,
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
    calculateFifoAllocation,
    computeAllocationFingerprint,
    ELIGIBLE_HEADER_STATUSES,
    ELIGIBLE_ALLOCATION_STATUSES,
    REASONS
};
