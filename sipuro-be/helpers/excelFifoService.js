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
        const actStartDate = parseExcelDate(row[14]); // Kolom O (index 14) untuk actual_production_date

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
 * Simulation & Calculation Service Alokasi Produksi Excel (Murni FIFO)
 * @param {Object} excelDataMap - Data hasil parse Excel
 * @param {Array} openAllocations - Daftar alokasi open dari DB
 * @param {Array} allProducts - Master produk dari DB
 * @param {number} poTolerance - Toleransi rasio PO dari DB (misal 0.90)
 */
const calculateFifoAllocation = (
    excelDataMap,
    openAllocations = [],
    allProducts = [],
    poTolerance
) => {
    if (poTolerance === undefined || poTolerance === null) {
        throw new Error('Nilai poTolerance wajib diberikan dari database company_profile.');
    }

    const previewResults = [];
    const unallocatedStocks = [];
    const detailedAllocations = [];

    Object.values(excelDataMap).forEach((excelItem) => {
        // Cari master produk di DB berdasarkan product_code
        const matchedProduct = allProducts.find(
            p => p.product_code === excelItem.itemCode
        );

        // Cari alokasi batch yang sesuai di DB (WAJIB COCOK KODE BATCH DAN KODE PRODUK)
        const matchedAllocations = openAllocations.filter(
            a => a.batch_number === excelItem.batchNumber && a.product_code === excelItem.itemCode
        );

        const hasProductInDb = !!matchedProduct;
        const hasBatchInDb = matchedAllocations.length > 0;

        // Syarat Terdaftar: Produk ada di DB DAN Batch terdaftar dengan produk yang sama
        const isRegistered = hasProductInDb && hasBatchInDb;

        let productName = '';
        if (hasProductInDb) {
            productName = matchedProduct.product_name;
        } else if (matchedAllocations.length > 0) {
            productName = matchedAllocations[0].product_name || '';
        }

        const totalPlannedQty = isRegistered
            ? matchedAllocations.reduce((sum, row) => sum + (Number(row.allocated_qty) || 0), 0)
            : 0;

        const previousFulfilledQty = isRegistered
            ? matchedAllocations.reduce((sum, row) => sum + (Number(row.fulfilled_qty) || 0), 0)
            : 0;

        const excelQty = excelItem.totalQtyOutput;

        let processedAllocations = [];

        // HANYA OLAH ALOKASI JIKA BARIS BENAR-BENAR TERDAFTAR
        if (isRegistered && matchedAllocations.length > 0) {
            let remainingExcelQty = excelQty;

            // Alokasi Murni FIFO (Berurutan berdasarkan prioritas PO)
            processedAllocations = matchedAllocations.map(alloc => {
                const planQty = Number(alloc.allocated_qty) || 0;
                const currentFulfilled = Number(alloc.fulfilled_qty) || 0;
                const neededQty = Math.max(0, planQty - currentFulfilled);

                let qtyToAdd = 0;
                if (remainingExcelQty > 0) {
                    qtyToAdd = neededQty > 0 ? Math.min(remainingExcelQty, neededQty) : 0;
                    remainingExcelQty = Math.max(0, remainingExcelQty - qtyToAdd);
                }

                const updatedFulfilled = currentFulfilled + qtyToAdd;
                const poRatio = planQty > 0 ? (updatedFulfilled / planQty) : 0;
                const isClosed = poRatio >= poTolerance;
                const rowStatus = isClosed ? 'Closed' : 'Open';

                detailedAllocations.push({
                    allocationId: alloc.id_allocation,
                    poDetailId: alloc.po_detail_id,
                    batchId: alloc.id_batch,
                    fulfilledQty: updatedFulfilled,
                    addedQty: qtyToAdd,
                    rowStatus: rowStatus,
                    actDate: excelItem.actStartDate
                });

                return {
                    allocationId: alloc.id_allocation,
                    poNumber: alloc.po_number,
                    planQty: planQty,
                    previousFulfilledQty: currentFulfilled,
                    rawExcelQty: excelQty,
                    addedAllocatedQty: qtyToAdd,
                    newFulfilledQty: updatedFulfilled,
                    fulfillmentPercentage: (poRatio * 100).toFixed(1),
                    status: rowStatus,
                    plan_production_date: alloc.plan_production_date
                };
            });
        }

        // Hitung total hasil excel pada upload ini yang berhasil dialokasikan ke PO-PO
        const totalAddedInThisUpload = processedAllocations.reduce(
            (sum, a) => sum + (a.addedAllocatedQty || 0),
            0
        );

        // Output preview hasil produksi
        previewResults.push({
            batchNumber: excelItem.batchNumber,
            productCode: excelItem.itemCode,
            productName: productName,
            actDate: excelItem.actStartDate,
            totalQtyOutput: excelQty,
            qtyProduced: excelQty,
            previousFulfilledQty: previousFulfilledQty,
            fulfilledQty: isRegistered ? totalAddedInThisUpload : 0,
            addedQty: excelQty,
            accumulatedQty: previousFulfilledQty + excelQty,
            totalPlannedQty: totalPlannedQty,
            isRegistered: isRegistered,
            allocations: isRegistered ? processedAllocations : []
        });

        // Sisa lebihan ke unallocated stocks (murni qty excel ini minus yang masuk PO)
        const excessQty = excelQty - totalAddedInThisUpload;

        if (isRegistered && excessQty > 0) {
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
