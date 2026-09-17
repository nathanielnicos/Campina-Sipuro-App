const xlsx = require('xlsx');
const crypto = require('crypto');

/**
 * Helper untuk memformat tanggal & jam dari Excel secara aman ke format SQL DATETIME (YYYY-MM-DD HH:mm:ss)
 */
const parseExcelDateTime = (excelDateVal, excelTimeVal) => {
    if (!excelDateVal) return null;

    let dateStr = null;

    // Handle Date
    if (typeof excelDateVal === 'number') {
        const dateObj = xlsx.SSF.parse_date_code(excelDateVal);
        if (dateObj) {
            const y = dateObj.y;
            const m = String(dateObj.m).padStart(2, '0');
            const d = String(dateObj.d).padStart(2, '0');
            dateStr = `${y}-${m}-${d}`;
        }
    } else {
        const parsedDate = new Date(excelDateVal);
        if (!isNaN(parsedDate.getTime())) {
            dateStr = parsedDate.toISOString().split('T')[0];
        }
    }

    if (!dateStr) return null;

    // Handle Time
    let timeStr = '00:00:00';
    if (excelTimeVal !== undefined && excelTimeVal !== null) {
        if (typeof excelTimeVal === 'number') {
            const timeObj = xlsx.SSF.parse_date_code(excelTimeVal);
            if (timeObj) {
                const hh = String(timeObj.H).padStart(2, '0');
                const mm = String(timeObj.M).padStart(2, '0');
                const ss = String(timeObj.S).padStart(2, '0');
                timeStr = `${hh}:${mm}:${ss}`;
            }
        } else if (typeof excelTimeVal === 'string' && excelTimeVal.trim() !== '') {
            const parts = excelTimeVal.trim().split(':');
            if (parts.length >= 2) {
                const hh = String(parts[0]).padStart(2, '0');
                const mm = String(parts[1]).padStart(2, '0');
                const ss = parts[2] ? String(parts[2]).padStart(2, '0') : '00';
                timeStr = `${hh}:${mm}:${ss}`;
            }
        }
    }

    return `${dateStr} ${timeStr}`;
};

/**
 * Membaca buffer file Excel dan mengekstrak metadata, fileHash, serta baris detail data + rowHash
 */
const parseProductionExcel = (fileBuffer) => {
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    let processTimestamp = 'UNKNOWN';
    if (rawData[0] && rawData[0][9]) {
        const rawHeader = String(rawData[0][9]);
        processTimestamp = rawHeader.replace('Proses :', '').trim();
    }

    const rawRows = [];

    for (let i = 4; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        // B = index 1, E = index 4, F = index 5, J = index 9, N = index 13
        const batchNumber = row[1] ? String(row[1]).trim() : '';
        const lotNumber = row[4] ? String(row[4]).trim() : '';
        const itemCode = row[5] ? String(row[5]).trim() : '';
        const lotStatus = row[9] ? String(row[9]).trim() : '';
        const qtyPac = parseInt(row[13], 10) || 0;

        if (!batchNumber || batchNumber === 'Batch Num.' || batchNumber === 'SubTot') {
            continue;
        }

        // Q = index 16, R = index 17 | S = index 18, T = index 19
        const startDatetime = parseExcelDateTime(row[16], row[17]);
        const completedDatetime = parseExcelDateTime(row[18], row[19]);

        const hashPayload = [
            batchNumber,
            lotNumber,
            itemCode,
            lotStatus,
            qtyPac,
            startDatetime || '',
            completedDatetime || ''
        ].join('|');

        const rowHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

        rawRows.push({
            batchNumber,
            lotNumber,
            itemCode,
            lotStatus,
            qtyPac,
            actualStartDatetime: startDatetime,
            actualCompletedDatetime: completedDatetime,
            rowHash
        });
    }

    return {
        processTimestamp,
        fileHash,
        rawRows
    };
};

/**
 * Calculation Service Alokasi Produksi Excel (Mendukung Positif & Negatif Koreksi)
 */
const calculateFifoAllocation = (
    rawRows = [],
    existingHashes = [],
    openAllocations = [],
    allProducts = [],
    poTolerance
) => {
    if (poTolerance === undefined || poTolerance === null) {
        throw new Error('The poTolerance value is required from the company_profile database.');
    }

    const hashSet = new Set(existingHashes);

    const categorizedDetails = {
        newRows: [],
        duplicateRows: [],
        unregisteredRows: [],
        nonGoodRows: [] // Tab ke-4 untuk menampung status lot selain GOOD
    };

    const newItemsAggregated = {};

    rawRows.forEach((row) => {
        const matchedProduct = allProducts.find(p => p.product_code === row.itemCode);
        const matchedAllocations = openAllocations.filter(
            a => a.batch_number === row.batchNumber && a.product_code === row.itemCode
        );

        const isRegistered = !!matchedProduct && matchedAllocations.length > 0;
        const isDuplicate = hashSet.has(row.rowHash);
        const isLotGood = row.lotStatus && row.lotStatus.toUpperCase() === 'GOOD';

        if (!isRegistered) {
            row.rowStatusCategory = 'UNREGISTERED';
            categorizedDetails.unregisteredRows.push(row);
        } else if (!isLotGood) {
            row.rowStatusCategory = 'NON_GOOD';
            categorizedDetails.nonGoodRows.push(row);
        } else if (isDuplicate) {
            row.rowStatusCategory = 'DUPLICATE';
            categorizedDetails.duplicateRows.push(row);
        } else {
            row.rowStatusCategory = 'NEW';
            categorizedDetails.newRows.push(row);

            // Hanya akumulasi baris yang NEW (Valid & Status Lot GOOD)
            const key = `${row.batchNumber}_${row.itemCode}`;
            if (!newItemsAggregated[key]) {
                newItemsAggregated[key] = {
                    batchNumber: row.batchNumber,
                    itemCode: row.itemCode,
                    totalQtyOutput: 0,
                    actStartDate: row.actualStartDatetime ? row.actualStartDatetime.split(' ')[0] : null
                };
            }
            newItemsAggregated[key].totalQtyOutput += row.qtyPac;
        }
    });

    const previewResults = [];
    const unallocatedStocks = [];
    const detailedAllocations = [];

    Object.values(newItemsAggregated).forEach((excelItem) => {
        const matchedProduct = allProducts.find(p => p.product_code === excelItem.itemCode);
        const matchedAllocations = openAllocations.filter(
            a => a.batch_number === excelItem.batchNumber && a.product_code === excelItem.itemCode
        );

        const productName = matchedProduct ? matchedProduct.product_name : (matchedAllocations[0]?.product_name || '');

        const totalPlannedQty = matchedAllocations.reduce((sum, row) => sum + (Number(row.allocated_qty) || 0), 0);
        const previousFulfilledQty = matchedAllocations.reduce((sum, row) => sum + (Number(row.fulfilled_qty) || 0), 0);
        const excelQty = excelItem.totalQtyOutput;

        let remainingExcelQty = excelQty;

        const processedAllocations = matchedAllocations.map((alloc, idx) => {
            const planQty = Number(alloc.allocated_qty) || 0;
            const currentFulfilled = Number(alloc.fulfilled_qty) || 0;

            let qtyToAdd = 0;

            if (remainingExcelQty < 0) {
                // Penanganan Koreksi Negatif (Minus)
                if (idx === matchedAllocations.length - 1) {
                    qtyToAdd = remainingExcelQty; // Terapkan sisa minus secara penuh
                    remainingExcelQty = 0;
                } else {
                    const maxDeduct = Math.min(currentFulfilled, Math.abs(remainingExcelQty));
                    qtyToAdd = -maxDeduct;
                    remainingExcelQty += maxDeduct;
                }
            } else if (remainingExcelQty > 0) {
                // Penanganan Alokasi Positif
                const neededQty = Math.max(0, planQty - currentFulfilled);
                qtyToAdd = neededQty > 0 ? Math.min(remainingExcelQty, neededQty) : 0;
                remainingExcelQty = Math.max(0, remainingExcelQty - qtyToAdd);
            }

            const updatedFulfilled = Math.max(0, currentFulfilled + qtyToAdd);
            const poRatio = planQty > 0 ? (updatedFulfilled / planQty) : 0;

            // Re-open jika di bawah toleransi, Close jika mencapai toleransi
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

        const totalAddedInThisUpload = processedAllocations.reduce((sum, a) => sum + (a.addedAllocatedQty || 0), 0);

        previewResults.push({
            batchNumber: excelItem.batchNumber,
            productCode: excelItem.itemCode,
            productName: productName,
            actDate: excelItem.actStartDate,
            totalQtyOutput: excelQty,
            qtyProduced: excelQty,
            previousFulfilledQty: previousFulfilledQty,
            fulfilledQty: totalAddedInThisUpload,
            addedQty: excelQty,
            accumulatedQty: previousFulfilledQty + excelQty,
            totalPlannedQty: totalPlannedQty,
            isRegistered: true,
            allocations: processedAllocations
        });

        const excessQty = excelQty - totalAddedInThisUpload;
        if (excessQty > 0) {
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
        categorizedDetails,
        summary: {
            totalRows: rawRows.length,
            newCount: categorizedDetails.newRows.length,
            duplicateCount: categorizedDetails.duplicateRows.length,
            unregisteredCount: categorizedDetails.unregisteredRows.length,
            nonGoodCount: categorizedDetails.nonGoodRows.length
        },
        previewResults,
        unallocatedStocks,
        detailedAllocations
    };
};

module.exports = {
    parseProductionExcel,
    calculateFifoAllocation
};
