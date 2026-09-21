/**
 * Automated FIFO Production Allocation Calculator Service
 */
const calculateFifoAllocation = (
    rawRows = [],
    existingHashes = [],
    openPoDetails = [],
    allProducts = [],
    poTolerance = 1.0
) => {
    if (poTolerance === undefined || poTolerance === null) {
        throw new Error('The poTolerance value is required from the company_profile database.');
    }

    const hashSet = new Set(existingHashes);

    const categorizedDetails = {
        newRows: [],
        duplicateRows: [],
        duplicateStatusUpdateRows: [],
        unregisteredRows: [],
        nonGoodRows: []
    };

    const newItemsAggregated = {};

    // 1. Categorize raw rows from Excel
    rawRows.forEach((row) => {
        const matchedProduct = allProducts.find(p => p.product_code === row.itemCode);
        const isRegistered = !!matchedProduct;
        const isDuplicate = hashSet.has(row.rowHash);
        const isLotGood = row.lotStatus && row.lotStatus.toUpperCase() === 'GOOD';

        if (!isRegistered) {
            row.rowStatusCategory = 'UNREGISTERED';
            categorizedDetails.unregisteredRows.push(row);
        } else if (isDuplicate) {
            // Data sudah pernah tersimpan di DB (yang di DB pasti berstatus GOOD)
            if (!isLotGood) {
                // Jika status di Excel sekarang bukan GOOD, berarti terjadi perubahan status
                row.rowStatusCategory = 'DUP_STATUS_UPDATE';
                row.previousLotStatus = 'GOOD';
                categorizedDetails.duplicateStatusUpdateRows.push(row);
            } else {
                // Jika status di Excel tetap GOOD, maka murni duplicate (skipped)
                row.rowStatusCategory = 'DUPLICATE';
                categorizedDetails.duplicateRows.push(row);
            }
        } else if (!isLotGood) {
            // Untuk baris BARU (belum ada di DB) yang statusnya NON-GOOD
            row.rowStatusCategory = 'NON_GOOD';
            categorizedDetails.nonGoodRows.push(row);
        } else {
            row.rowStatusCategory = 'NEW';
            categorizedDetails.newRows.push(row);

            // Sum Qty per batch
            const key = `${row.batchNumber}_${row.itemCode}`;
            if (!newItemsAggregated[key]) {
                newItemsAggregated[key] = {
                    batchNumber: row.batchNumber,
                    itemCode: row.itemCode,
                    totalQtyOutput: 0,
                    actualStartDatetime: row.actualStartDatetime || null,
                    actualCompletedDatetime: row.actualCompletedDatetime || null
                };
            }
            newItemsAggregated[key].totalQtyOutput += Number(row.qtyPac) || 0;

            // Track earliest start & latest completion timestamp
            if (row.actualStartDatetime) {
                if (
                    !newItemsAggregated[key].actualStartDatetime ||
                    row.actualStartDatetime < newItemsAggregated[key].actualStartDatetime
                ) {
                    newItemsAggregated[key].actualStartDatetime = row.actualStartDatetime;
                }
            }
            if (row.actualCompletedDatetime) {
                if (
                    !newItemsAggregated[key].actualCompletedDatetime ||
                    row.actualCompletedDatetime > newItemsAggregated[key].actualCompletedDatetime
                ) {
                    newItemsAggregated[key].actualCompletedDatetime = row.actualCompletedDatetime;
                }
            }
        }
    });

    // 2. Sort valid batch aggregates by actualCompletedDatetime ASC
    const sortedBatchItems = Object.values(newItemsAggregated).sort((a, b) => {
        if (!a.actualCompletedDatetime) return -1;
        if (!b.actualCompletedDatetime) return 1;
        return new Date(a.actualCompletedDatetime) - new Date(b.actualCompletedDatetime);
    });

    // 3. Initialize dynamic PO state tracker
    const poStateMap = new Map();
    openPoDetails.forEach((po) => {
        const baseQty = Number(po.base_qty) || 0;
        const fulfilledQty = Number(po.fulfilled_qty) || 0;
        poStateMap.set(po.po_detail_id, {
            poDetailId: po.po_detail_id,
            poHeaderId: po.po_header_id,
            poNumber: po.po_number,
            idProduct: po.id_product,
            productCode: po.product_code,
            productName: po.product_name,
            createdAt: po.created_at,
            baseQty: baseQty,
            currentFulfilledQty: fulfilledQty,
            targetRequiredQty: Math.round(baseQty * poTolerance)
        });
    });

    const previewResults = [];
    const unallocatedStocks = [];
    const detailedAllocations = [];

    // 4. Perform FIFO Allocation
    sortedBatchItems.forEach((excelItem) => {
        const matchedProduct = allProducts.find(p => p.product_code === excelItem.itemCode);
        const productName = matchedProduct ? matchedProduct.product_name : '';

        const candidatePoList = Array.from(poStateMap.values())
            .filter(po => po.productCode === excelItem.itemCode)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        let remainingExcelQty = excelItem.totalQtyOutput;
        const batchAllocations = [];

        candidatePoList.forEach((poState) => {
            if (remainingExcelQty <= 0) return;

            const neededQty = poState.targetRequiredQty - poState.currentFulfilledQty;

            if (neededQty > 0) {
                const qtyToAdd = Math.min(remainingExcelQty, neededQty);

                if (qtyToAdd > 0) {
                    const previousFulfilled = poState.currentFulfilledQty;
                    const newFulfilled = previousFulfilled + qtyToAdd;

                    poState.currentFulfilledQty = newFulfilled;

                    const poRatio = poState.baseQty > 0 ? (newFulfilled / poState.baseQty) : 0;
                    const isClosed = newFulfilled >= poState.targetRequiredQty;
                    const allocationStatus = isClosed ? 'Closed' : 'Open';

                    batchAllocations.push({
                        poDetailId: poState.poDetailId,
                        poNumber: poState.poNumber,
                        poQty: poState.baseQty,
                        previousFulfilledQty: previousFulfilled,
                        addedQty: qtyToAdd,
                        newFulfilledQty: newFulfilled,
                        fulfillmentPercentage: (poRatio * 100).toFixed(1),
                        status: allocationStatus
                    });

                    detailedAllocations.push({
                        poDetailId: poState.poDetailId,
                        batchNumber: excelItem.batchNumber,
                        productCode: excelItem.itemCode,
                        fulfilledQty: newFulfilled,
                        addedQty: qtyToAdd,
                        rowStatus: allocationStatus,
                        actDate: excelItem.actualStartDatetime ? excelItem.actualStartDatetime.split(' ')[0] : null
                    });

                    remainingExcelQty -= qtyToAdd;
                }
            }
        });

        // Push valid allocated batches
        if (batchAllocations.length > 0) {
            previewResults.push({
                batchNumber: excelItem.batchNumber,
                productCode: excelItem.itemCode,
                productName: productName,
                actualStartDatetime: excelItem.actualStartDatetime,
                actualCompletedDatetime: excelItem.actualCompletedDatetime,
                totalQtyOutput: excelItem.totalQtyOutput,
                allocations: batchAllocations
            });
        }

        // Remaining unallocated Qty
        if (remainingExcelQty > 0) {
            unallocatedStocks.push({
                batchNumber: excelItem.batchNumber,
                productCode: excelItem.itemCode,
                idProduct: matchedProduct ? matchedProduct.id_product : null,
                productName: productName,
                qtyAvailable: remainingExcelQty,
                actualStartDatetime: excelItem.actualStartDatetime,
                actualCompletedDatetime: excelItem.actualCompletedDatetime,
                productionDate: excelItem.actualStartDatetime ? excelItem.actualStartDatetime.split(' ')[0] : null
            });
        }
    });

    return {
        categorizedDetails,
        duplicateRows: categorizedDetails.duplicateRows,
        duplicateStatusUpdateRows: categorizedDetails.duplicateStatusUpdateRows,
        unregisteredRows: categorizedDetails.unregisteredRows,
        nonGoodRows: categorizedDetails.nonGoodRows,
        summary: {
            totalRows: rawRows.length,
            newCount: previewResults.length,
            duplicateCount: categorizedDetails.duplicateRows.length,
            duplicateStatusUpdateCount: categorizedDetails.duplicateStatusUpdateRows.length,
            unregisteredCount: categorizedDetails.unregisteredRows.length,
            nonGoodCount: categorizedDetails.nonGoodRows.length,
            unallocatedCount: unallocatedStocks.length
        },
        previewResults,
        unallocatedStocks,
        detailedAllocations
    };
};

module.exports = {
    calculateFifoAllocation
};
