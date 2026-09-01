const xlsx = require('xlsx');

/**
 * Helper untuk memformat tanggal dari Excel secara aman
 */
const parseExcelDate = (excelValue) => {
    if (!excelValue) return null;

    if (typeof excelValue === 'number') {
        const dateObj = xlsx.SSF.parse_date_code(excelValue);
        if (dateObj) {
            const y = dateObj.y;
            const m = String(dateObj.m).padStart(2, '0');
            const d = String(dateObj.d).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }

    const parsedDate = new Date(excelValue);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
    }

    return null;
};

/**
 * Membaca buffer file Excel dan mengekstrak metadata & baris data
 */
const parseProductionExcel = (fileBuffer) => {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    let processTimestamp = 'UNKNOWN';
    if (rawData[0] && rawData[0][9]) {
        const rawHeader = String(rawData[0][9]);
        processTimestamp = rawHeader.replace('Proses :', '').trim();
    }

    const productionItems = [];

    for (let i = 4; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const batchNumber = row[1];
        const itemCode = row[5];
        const qtyPac = parseInt(row[12], 10) || 0;
        const actStartDate = parseExcelDate(row[14]);

        if (batchNumber && itemCode && batchNumber !== 'Batch Num.' && batchNumber !== 'SubTot') {
            productionItems.push({
                batchNumber: String(batchNumber).trim(),
                itemCode: String(itemCode).trim(),
                qtyPac: qtyPac,
                actStartDate: actStartDate
            });
        }
    }

    // Agregasi per baris unik di Excel (Batch + ItemCode)
    const aggregatedExcel = {};
    productionItems.forEach((item) => {
        const key = `${item.batchNumber}_${item.itemCode}`;
        if (!aggregatedExcel[key]) {
            aggregatedExcel[key] = {
                batchNumber: item.batchNumber,
                itemCode: item.itemCode,
                totalQtyOutput: 0,
                actStartDate: item.actStartDate
            };
        }
        aggregatedExcel[key].totalQtyOutput += item.qtyPac;
    });

    return {
        processTimestamp,
        excelDataMap: aggregatedExcel
    };
};

/**
 * Pengecekan Ketersediaan Batch & SKU di Database + Akumulasi Alokasi FIFO (Toleransi 90%)
 */
const calculateFifoAllocation = (excelDataMap, openAllocations = [], allProducts = []) => {
    const previewResults = [];
    const unallocatedStocks = [];
    const detailedAllocations = [];

    Object.values(excelDataMap).forEach((excelItem) => {
        // Cari alokasi batch yang sesuai di DB
        const matchedAllocations = openAllocations.filter(
            a => a.batch_number === excelItem.batchNumber
        );

        // Cari master produk di DB
        const matchedProduct = allProducts.find(
            p => p.product_code === excelItem.itemCode
        );

        const hasBatchInDb = matchedAllocations.length > 0;
        const hasProductInDb = !!matchedProduct;
        const isRegistered = hasBatchInDb && hasProductInDb;

        let productName = matchedProduct ? matchedProduct.product_name : '';
        if (!productName && hasBatchInDb && matchedAllocations[0].product_name) {
            productName = matchedAllocations[0].product_name;
        }

        // Kalkulasi akumulasi Qty
        const totalPlannedQty = matchedAllocations.reduce((sum, row) => sum + (Number(row.allocated_qty) || 0), 0);
        const previousFulfilledQty = matchedAllocations.reduce((sum, row) => sum + (Number(row.fulfilled_qty) || 0), 0);

        const newAdditionQty = isRegistered ? excelItem.totalQtyOutput : 0;
        const totalAccumulatedQty = previousFulfilledQty + newAdditionQty;

        // Distribusi FIFO & Evaluasi Toleransi 90% per alokasi
        let remainingExcelQty = newAdditionQty;
        const processedAllocations = matchedAllocations.map(alloc => {
            const planQty = Number(alloc.allocated_qty) || 0;
            const currentFulfilled = Number(alloc.fulfilled_qty) || 0;
            const neededQty = Math.max(0, planQty - currentFulfilled);

            const qtyToAdd = Math.min(remainingExcelQty, neededQty);
            remainingExcelQty -= qtyToAdd;

            const updatedFulfilled = currentFulfilled + qtyToAdd;
            const fulfillmentRatio = planQty > 0 ? (updatedFulfilled / planQty) : 0;
            const isClosed = fulfillmentRatio >= 0.90; // Toleransi 90%
            const rowStatus = isClosed ? 'Close' : 'Open';

            const detailItem = {
                allocationId: alloc.id_allocation,
                poDetailId: alloc.po_detail_id,
                batchId: alloc.id_batch,
                fulfilledQty: updatedFulfilled,
                addedQty: qtyToAdd,
                rowStatus: rowStatus,
                actDate: excelItem.actStartDate
            };

            if (isRegistered) {
                detailedAllocations.push(detailItem);
            }

            return {
                ...alloc,
                previous_fulfilled_qty: currentFulfilled,
                added_qty: qtyToAdd,
                new_fulfilled_qty: updatedFulfilled,
                status: rowStatus
            };
        });

        previewResults.push({
            batchNumber: excelItem.batchNumber,
            productCode: excelItem.itemCode,
            productName: productName,
            actDate: excelItem.actStartDate,
            totalQtyOutput: excelItem.totalQtyOutput,
            previousFulfilledQty: previousFulfilledQty,
            fulfilledQty: newAdditionQty,
            accumulatedQty: totalAccumulatedQty,
            totalPlannedQty: totalPlannedQty,
            isRegistered: isRegistered,
            allocations: processedAllocations
        });

        // Hitung stok lebihan jika total akumulasi melebihi total rencana
        if (isRegistered && totalPlannedQty > 0 && totalAccumulatedQty > totalPlannedQty) {
            const excessQty = totalAccumulatedQty - totalPlannedQty;
            unallocatedStocks.push({
                batchNumber: excelItem.batchNumber,
                productCode: excelItem.itemCode,
                idProduct: matchedProduct ? matchedProduct.id_product : (matchedAllocations[0] ? matchedAllocations[0].id_product : null),
                productName: productName,
                qtyAvailable: excessQty,
                productionDate: excelItem.actStartDate
            });
        }
    });

    return {
        previewResults,
        unallocatedStocks,
        detailedAllocations
    };
};

module.exports = {
    parseProductionExcel,
    calculateFifoAllocation
};
