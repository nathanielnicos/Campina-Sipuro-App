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
 * Membaca buffer file Excel dan mengekstrak metadata & baris data aktual
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
 * Algoritma FIFO + Pro-rata Toleransi 90%
 */
const calculateFifoAllocation = (excelDataMap, openAllocations, allProducts = []) => {
    const previewResults = [];
    const unallocatedStocks = [];

    const excelStockMap = { ...excelDataMap };

    // 1. Kelompokkan alokasi DB berdasarkan batch_number
    const batchGroup = {};
    openAllocations.forEach((alloc) => {
        if (!batchGroup[alloc.batch_number]) {
            batchGroup[alloc.batch_number] = {
                id_batch: alloc.id_batch,
                batch_number: alloc.batch_number,
                id_product: alloc.id_product,
                plan_production_date: alloc.plan_production_date,
                totalPlannedQty: 0,
                rows: []
            };
        }
        batchGroup[alloc.batch_number].totalPlannedQty += alloc.allocated_qty;
        batchGroup[alloc.batch_number].rows.push(alloc);
    });

    // 2. Evaluasi Setiap Batch yang ada di Aplikasi
    Object.values(batchGroup).forEach((batch) => {
        const matchedExcelKey = Object.keys(excelStockMap).find(k => k.startsWith(`${batch.batch_number}_`));
        const excelMatch = matchedExcelKey ? excelStockMap[matchedExcelKey] : null;

        const actualOutput = excelMatch ? excelMatch.totalQtyOutput : 0;
        const actStartDate = excelMatch ? excelMatch.actStartDate : null;
        const plannedQty = batch.totalPlannedQty;

        const realizationRatio = plannedQty > 0 ? (actualOutput / plannedQty) : 0;
        const isBatchClose = realizationRatio >= 0.90; // Toleransi >= 90%

        let remainingExcelQty = actualOutput;

        batch.rows.forEach((row, idx) => {
            let fulfilledQty = 0;

            if (isBatchClose && realizationRatio <= 1.0) {
                if (idx === batch.rows.length - 1) {
                    fulfilledQty = remainingExcelQty;
                } else {
                    fulfilledQty = Math.round(row.allocated_qty * realizationRatio);
                }
            } else {
                fulfilledQty = Math.min(row.allocated_qty, remainingExcelQty);
            }

            remainingExcelQty -= fulfilledQty;

            const isRowClosed = fulfilledQty >= row.allocated_qty || (isBatchClose && fulfilledQty > 0);

            previewResults.push({
                allocationId: row.id_allocation,
                poDetailId: row.po_detail_id,
                poNumber: row.po_number,
                batchId: batch.id_batch,
                batchNumber: batch.batch_number,
                productCode: row.product_code,
                productName: row.product_name,
                allocatedQty: row.allocated_qty,
                fulfilledQty: fulfilledQty,
                rowStatus: isRowClosed ? 'Close' : 'Open',
                planDate: batch.plan_production_date,
                actDate: actStartDate,
                isRatioTolerated: realizationRatio >= 0.90 && realizationRatio < 1.0
            });
        });

        if (remainingExcelQty > 0 && excelMatch) {
            const firstRow = batch.rows[0] || {};

            // Perbaikan Fallback Nama Produk
            const matchedMasterProduct = allProducts.find(p => p.product_code === (firstRow.product_code || excelMatch.itemCode));
            const productNameDisplay = firstRow.product_name || (matchedMasterProduct ? matchedMasterProduct.product_name : '');

            unallocatedStocks.push({
                batchNumber: batch.batch_number,
                idProduct: batch.id_product,
                productCode: firstRow.product_code || excelMatch.itemCode || '',
                productName: productNameDisplay,
                qtyAvailable: remainingExcelQty,
                productionDate: actStartDate
            });
        }

        if (matchedExcelKey) {
            delete excelStockMap[matchedExcelKey];
        }
    });

    // 3. Tangani Batch Baru dari Excel yang tidak terdaftar di PO manapun
    Object.values(excelStockMap).forEach((unmatched) => {
        const matchedAllocation = openAllocations.find(a => a.product_code === unmatched.itemCode);
        const matchedMasterProduct = allProducts.find(p => p.product_code === unmatched.itemCode);

        const productCodeDisplay = unmatched.itemCode || 'SKU Tidak Diketahui';

        // Perbaikan pencarian nama produk
        let productNameDisplay = '';
        if (matchedAllocation && matchedAllocation.product_name) {
            productNameDisplay = matchedAllocation.product_name;
        } else if (matchedMasterProduct && matchedMasterProduct.product_name) {
            productNameDisplay = matchedMasterProduct.product_name;
        }

        unallocatedStocks.push({
            batchNumber: unmatched.batchNumber,
            itemCode: unmatched.itemCode,
            productCode: productCodeDisplay,
            productName: productNameDisplay,
            qtyAvailable: unmatched.totalQtyOutput,
            productionDate: unmatched.actStartDate,
            isNewUnregisteredBatch: true
        });
    });

    return {
        previewResults,
        unallocatedStocks
    };
};

module.exports = {
    parseProductionExcel,
    calculateFifoAllocation
};
