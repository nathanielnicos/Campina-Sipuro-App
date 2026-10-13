/**
 * Document Flow calculator (pure function, no database access).
 *
 * Used EXACTLY the same by preview and commit, so what the user sees in the preview is what the
 * commit saves. The commit recalculates from the uploaded file inside a transaction and compares
 * the fingerprint.
 *
 * Every Excel row falls into exactly one bucket, checked in this order:
 *   1. nonInterfacedRows  Delivery Status is not "Interfaced"                       (not saved)
 *   2. rowsToFix          mandatory column empty / invalid format                   (blocks Save)
 *   3. unregisteredRows   SKU not registered, product master incomplete, or any PO
 *                         in the Customer PO cell not registered                    (not saved)
 *   4. rowsToFix          same DO + item appears more than once in the file         (blocks Save)
 *   5. duplicateRows      DO (or SI) already saved in the database                  (not saved)
 *   6. rowsToFix          Qty Delivery <> Qty Invoice, qty in pcs not a whole
 *                         number, or FIFO allocation not possible                   (blocks Save)
 *   7. previewResults     valid, with FIFO allocation                               (saved)
 */
const crypto = require('crypto');
const { resolvePoReferences, buildRegisteredPoMap } = require('./poExtractorHelper');
const { generateDoRowHash, generateSiRowHash } = require('./hashGeneratorHelper');
const { allocateFifo } = require('./fifoMatcherHelper');
const { INTERFACED_STATUS } = require('./documentFlowConfig');

const isBlank = (v) => v === null || v === undefined || v === '';

const byRowNumber = (a, b) => a.excelRowNumber - b.excelRowNumber;

const baseRowInfo = (row) => ({
    excelRowNumber: row.excelRowNumber,
    itemCode: row.itemCode,
    customerPoText: row.customerPoText,
    doNumber: row.doNumber,
    deliveryStatus: row.deliveryStatus,
    invoiceNumber: row.invoiceNumber,
    qtyCtnDO: row.qtyCtnDO,
    qtyCtnSI: row.qtyCtnSI,
    pickUpDate: row.pickUpDate,
    siDate: row.siDate,
    doCreatedAt: row.doCreatedAt
});

// Mandatory columns of an Interfaced row
const collectMandatoryProblems = (row) => {
    const problems = [];
    const missing = (column) => problems.push({ column, message: 'Required value is empty' });

    if (isBlank(row.itemCode)) missing('Item');
    if (isBlank(row.customerPoText)) missing('Customer PO');
    if (isBlank(row.doNumber)) missing('Delivery No.');
    if (isBlank(row.invoiceNumber)) missing('Invoice No.');

    // Values that failed to parse are reported with their own message; empty ones as "empty"
    const parseErrorColumns = new Set(row.parseErrors.map((e) => e.column));
    const pushQty = (value, column) => {
        if (parseErrorColumns.has(column)) return;
        if (isBlank(value)) missing(column);
        else if (!(value > 0)) problems.push({ column, message: 'Quantity must be greater than 0' });
    };
    pushQty(row.qtyCtnDO, 'Qty Delivery');
    pushQty(row.qtyCtnSI, 'Qty Invoice (CAR)');

    if (!parseErrorColumns.has('Pick Up Date') && isBlank(row.pickUpDate)) missing('Pick Up Date');
    if (!parseErrorColumns.has('GL Date') && isBlank(row.siDate)) missing('GL Date');
    if (!parseErrorColumns.has('DO Creation Date') && isBlank(row.doCreatedAt)) missing('DO Creation Date');

    return [...row.parseErrors, ...problems];
};

const toFixRow = (row, problems, extra = {}) => ({ ...baseRowInfo(row), problems, ...extra });

const calculateDocumentFlow = ({
    rows = [],
    existingHashes = [],
    allProducts = [],
    poRows = [],
    allocations = [],
    latestSavedDoAt = null
}) => {
    const existingHashSet = new Set(existingHashes);

    const productByCode = new Map();
    allProducts.forEach((p) => productByCode.set(String(p.product_code).trim().toUpperCase(), p));

    const registeredPoMap = buildRegisteredPoMap(poRows);

    const nonInterfacedRows = [];
    const rowsToFix = [];
    const unregisteredRows = [];
    const duplicateRows = [];
    const pending = [];
    let canceledInvoiceCount = 0;

    // ---------- Pass A: steps 1-3 ----------
    rows.forEach((row) => {
        if (row.canceledInvoice === 'YES') canceledInvoiceCount += 1;

        // 1. Non-Interfaced
        if (String(row.deliveryStatus || '').trim().toUpperCase() !== INTERFACED_STATUS) {
            nonInterfacedRows.push({ ...baseRowInfo(row) });
            return;
        }

        // 2. Mandatory columns
        const problems = collectMandatoryProblems(row);
        if (problems.length > 0) {
            rowsToFix.push(toFixRow(row, problems));
            return;
        }

        // 3. Registered SKU and PO
        const reasons = [];
        const product = productByCode.get(String(row.itemCode).trim().toUpperCase());
        let unregisteredSku = false;
        if (!product) {
            unregisteredSku = true;
            reasons.push({ type: 'SKU', message: `SKU "${row.itemCode}" is not registered in the product master.` });
        } else if (!(Number(product.pcs_per_ctn) > 0)) {
            unregisteredSku = true;
            reasons.push({ type: 'SKU_MASTER', message: `SKU "${row.itemCode}" has no pcs per carton in the product master.` });
        }

        const poResult = resolvePoReferences(row.customerPoText, registeredPoMap);
        const poNotFound = poResult.matched.length === 0 && poResult.unknown.length === 0;
        if (poNotFound) {
            reasons.push({ type: 'PO', message: 'No registered PO number was found in the Customer PO text.' });
        }
        poResult.unknown.forEach((u) => {
            reasons.push({ type: 'PO', message: `PO "${u.text}" is not registered.` });
        });

        if (reasons.length > 0) {
            unregisteredRows.push({
                ...baseRowInfo(row),
                reasons,
                unregisteredSku,
                poNotFound,
                unknownPo: poResult.unknown
            });
            return;
        }

        pending.push({
            row,
            product,
            matchedPoNumbers: new Set(poResult.matched),
            expandedPo: poResult.expanded,
            rowHashDO: generateDoRowHash(row.doNumber, product.id_product),
            rowHashSI: generateSiRowHash(row.invoiceNumber, row.doNumber, product.id_product)
        });
    });

    // ---------- Pass B: steps 4-6 (except FIFO) ----------
    const occurrences = new Map();
    pending.forEach((p) => {
        if (!occurrences.has(p.rowHashDO)) occurrences.set(p.rowHashDO, []);
        occurrences.get(p.rowHashDO).push(p.row.excelRowNumber);
    });

    const fifoQueue = [];
    pending.forEach((p) => {
        const { row, product } = p;

        // 4. Same DO + item more than once in this file
        const sameKeyRows = occurrences.get(p.rowHashDO);
        if (sameKeyRows.length > 1) {
            const others = sameKeyRows.filter((n) => n !== row.excelRowNumber);
            rowsToFix.push(toFixRow(row, [{
                column: 'Delivery No. / Item',
                message: `The same DO number and item also appear on Excel row ${others.join(', ')}.`
            }]));
            return;
        }

        // 5. Already saved
        if (existingHashSet.has(p.rowHashDO) || existingHashSet.has(p.rowHashSI)) {
            duplicateRows.push({
                ...baseRowInfo(row),
                productCode: product.product_code,
                productName: product.product_name,
                reason: 'This DO and item have already been saved.'
            });
            return;
        }

        // 6. Qty checks
        const problems = [];
        if (Math.round(row.qtyCtnDO * 100) !== Math.round(row.qtyCtnSI * 100)) {
            problems.push({
                column: 'Qty Delivery / Qty Invoice (CAR)',
                message: `Qty Delivery (${row.qtyCtnDO}) is different from Qty Invoice (${row.qtyCtnSI}).`
            });
        }

        const pcsPerCtn = Number(product.pcs_per_ctn);
        const pcsTimes100 = Math.round(row.qtyCtnDO * 100) * pcsPerCtn;
        let qtyPcs = null;
        if (pcsTimes100 % 100 !== 0) {
            problems.push({
                column: 'Qty Delivery',
                message: `${row.qtyCtnDO} ctn x ${pcsPerCtn} pcs per ctn = ${pcsTimes100 / 100} pcs, which is not a whole number.`
            });
        } else {
            qtyPcs = pcsTimes100 / 100;
        }

        if (problems.length > 0) {
            rowsToFix.push(toFixRow(row, problems));
            return;
        }

        fifoQueue.push({ ...p, qtyPcs, pcsPerCtn });
    });

    // ---------- Pass C: step 7, FIFO ----------
    const ledger = new Map();
    const allocationsByProduct = new Map();
    allocations.forEach((a) => {
        ledger.set(a.allocation_id, Math.max(0, (Number(a.allocated_qty) || 0) - (Number(a.consumed_qty) || 0)));
        if (!allocationsByProduct.has(a.id_product)) allocationsByProduct.set(a.id_product, []);
        allocationsByProduct.get(a.id_product).push({
            allocationId: a.allocation_id,
            poDetailId: a.po_detail_id,
            poHeaderId: a.po_header_id,
            poNumber: a.po_number,
            poCreatedAt: a.po_created_at,
            batchId: a.batch_id,
            batchNumber: a.batch_number,
            completedAt: a.actual_completed_at,
            fifoDate: a.fifo_date
        });
    });

    fifoQueue.sort((a, b) => {
        if (a.row.doCreatedAt !== b.row.doCreatedAt) return a.row.doCreatedAt < b.row.doCreatedAt ? -1 : 1;
        return a.row.excelRowNumber - b.row.excelRowNumber;
    });

    const previewResults = [];
    fifoQueue.forEach((p) => {
        const { row, product } = p;
        const candidates = (allocationsByProduct.get(product.id_product) || [])
            .filter((c) => p.matchedPoNumbers.has(c.poNumber));

        const result = allocateFifo({ qtyPcs: p.qtyPcs, doCreatedAt: row.doCreatedAt, candidates, ledger });
        if (!result.ok) {
            rowsToFix.push(toFixRow(row, [{ column: 'Allocation', message: result.message }], { reasonCode: result.reason }));
            return;
        }

        previewResults.push({
            ...baseRowInfo(row),
            productId: product.id_product,
            productCode: product.product_code,
            productName: product.product_name,
            pcsPerCtn: p.pcsPerCtn,
            qtyPcs: p.qtyPcs,
            rowHashDO: p.rowHashDO,
            rowHashSI: p.rowHashSI,
            expandedPo: p.expandedPo,
            allocations: result.parts.map((part) => ({
                allocationId: part.allocation.allocationId,
                poDetailId: part.allocation.poDetailId,
                poHeaderId: part.allocation.poHeaderId,
                poNumber: part.allocation.poNumber,
                poCreatedAt: part.allocation.poCreatedAt,
                batchNumber: part.allocation.batchNumber,
                completedAt: part.allocation.completedAt,
                qtyPcs: part.qtyPcs,
                qtyCtn: Math.round((part.qtyPcs / p.pcsPerCtn) * 100) / 100
            }))
        });
    });

    previewResults.sort(byRowNumber);
    rowsToFix.sort(byRowNumber);
    unregisteredRows.sort(byRowNumber);
    duplicateRows.sort(byRowNumber);
    nonInterfacedRows.sort(byRowNumber);

    // ---------- Non-blocking information ----------
    const warnings = [];
    if (latestSavedDoAt) {
        const older = previewResults.filter((r) => r.doCreatedAt < latestSavedDoAt);
        if (older.length > 0) {
            warnings.push({
                type: 'OLDER_THAN_SAVED_DO',
                message: `${older.length} row(s) have a DO creation date earlier than the latest saved DO (${latestSavedDoAt}). FIFO is applied on top of the allocations that are already saved; saved allocations are not re-arranged.`,
                rows: older.slice(0, 20).map((r) => r.excelRowNumber)
            });
        }
    }

    return {
        previewResults,
        duplicateRows,
        unregisteredRows,
        nonInterfacedRows,
        rowsToFix,
        warnings,
        summary: {
            totalRows: rows.length,
            validCount: previewResults.length,
            validAllocationCount: previewResults.reduce((sum, r) => sum + r.allocations.length, 0),
            duplicateCount: duplicateRows.length,
            unregisteredCount: unregisteredRows.length,
            nonInterfacedCount: nonInterfacedRows.length,
            rowsToFixCount: rowsToFix.length,
            canceledInvoiceCount
        },
        canSave: rowsToFix.length === 0 && previewResults.length > 0
    };
};

/**
 * Fingerprint of everything the commit would save. Preview sends it to the client, the commit
 * recalculates and rejects the save when it differs (for example, an allocation changed in between).
 */
const computeDocumentFlowFingerprint = (calculation, fileHash) => {
    const payload = {
        fileHash,
        valid: calculation.previewResults.map((r) => [
            r.rowHashDO,
            r.rowHashSI,
            r.doCreatedAt,
            r.pickUpDate,
            r.siDate,
            r.qtyCtnDO,
            r.qtyCtnSI,
            r.qtyPcs,
            r.allocations.map((a) => [a.allocationId, a.qtyPcs])
        ]),
        counts: [
            calculation.duplicateRows.length,
            calculation.unregisteredRows.length,
            calculation.nonInterfacedRows.length,
            calculation.rowsToFix.length
        ]
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

module.exports = { calculateDocumentFlow, computeDocumentFlowFingerprint };
