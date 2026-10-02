const {
    refreshPOStatus,
    refreshBatchStatus,
    refreshPODetailFulfilledQty,
    updateBatchProductionDates
} = require('./batchHelper');
const { logAllocationInsert, logAllocationUpdate } = require('./poBatchAllocationLogHelper');
const { getWibDate } = require('./dateHelper');

/**
 * Helper untuk mengekstrak string YYYY-MM-DD dari string tanggal/datetime secara aman
 */
const formatDateOnly = (dateVal) => {
    if (!dateVal) {
        const nowWib = getWibDate();
        const year = nowWib.getFullYear();
        const month = String(nowWib.getMonth() + 1).padStart(2, '0');
        const day = String(nowWib.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    if (typeof dateVal === 'string') {
        return dateVal.split('T')[0].split(' ')[0];
    }

    if (dateVal instanceof Date) {
        const dWib = getWibDate(dateVal);
        const year = dWib.getFullYear();
        const month = String(dWib.getMonth() + 1).padStart(2, '0');
        const day = String(dWib.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return dateVal;
};

/**
 * Helper untuk commit data alokasi dan master terkait ke database
 */
const commitProductionAllocationTransaction = async (connection, {
    fileName,
    processTimestamp,
    fileHash,
    userId,
    allocations = [],
    newDetails = [],
    detailedAllocations = []
}) => {
    const currentUserId = userId || null;

    // 1. Insert log upload file produksi
    const [uploadLogResult] = await connection.query(
        'INSERT INTO production_upload_logs (file_name, process_timestamp, file_hash, uploaded_by) VALUES (?, ?, ?, ?)',
        [fileName, processTimestamp, fileHash || null, currentUserId]
    );
    const uploadLogId = uploadLogResult.insertId;

    const affectedBatchNumbers = new Set();

    // 2. Insert detail baris data mentah Excel yang valid ke production_upload_details
    if (newDetails && newDetails.length > 0) {
        const detailValues = newDetails.map(detail => {
            if (detail.batchNumber) {
                affectedBatchNumbers.add(detail.batchNumber);
            }
            return [
                uploadLogId,
                detail.batchNumber,
                detail.lotNumber || null,
                detail.itemCode,
                detail.lotStatus || null,
                detail.qtyPac || 0,
                detail.actualStartDatetime || null,
                detail.actualCompletedDatetime || null,
                detail.rowHash
            ];
        });

        await connection.query(
            `INSERT INTO production_upload_details 
            (upload_log_id, batch_number, lot_number, item_code, lot_status, qty_pac, actual_start_datetime, actual_completed_datetime, row_hash) 
            VALUES ?`,
            [detailValues]
        );
    }

    // Sumber data alokasi yang akan diproses
    const sourceAllocations = detailedAllocations.length > 0 ? detailedAllocations : allocations;

    // 3. Auto-create atau Find-or-Create Master Batch
    const batchIdMap = new Map();
    const uniqueBatchData = new Map();

    const collectBatchInfo = (batchNumber, itemCode, startDt, completeDt) => {
        if (batchNumber && itemCode) {
            const compositeKey = `${batchNumber}_${itemCode}`;
            if (!uniqueBatchData.has(compositeKey)) {
                uniqueBatchData.set(compositeKey, {
                    batchNumber,
                    itemCode,
                    actualStartDatetime: startDt || null,
                    actualCompletedDatetime: completeDt || null
                });
            }
        }
    };

    newDetails.forEach(d => collectBatchInfo(d.batchNumber, d.itemCode, d.actualStartDatetime, d.actualCompletedDatetime));
    sourceAllocations.forEach(a => collectBatchInfo(a.batchNumber || a.batch_number, a.productCode || a.product_code || a.itemCode, a.actualStartDatetime, a.actualCompletedDatetime));

    for (const [compositeKey, bInfo] of uniqueBatchData.entries()) {
        const [[product]] = await connection.query(
            'SELECT id_product FROM products WHERE product_code = ? LIMIT 1',
            [bInfo.itemCode]
        );

        if (product) {
            const [[existingBatch]] = await connection.query(
                'SELECT id FROM batches WHERE batch_number = ? AND id_product = ? LIMIT 1',
                [bInfo.batchNumber, product.id_product]
            );

            if (existingBatch) {
                batchIdMap.set(compositeKey, existingBatch.id);
            } else {
                // Penentuan planDate berbasis WIB menggunakan helper formatDateOnly
                const planDate = formatDateOnly(bInfo.actualStartDatetime);

                const [insertBatch] = await connection.query(
                    `INSERT INTO batches (batch_number, id_product, plan_production_date, actual_production_date, actual_completed_date, status, created_by)
                     VALUES (?, ?, ?, ?, ?, 'Open', ?)`,
                    [
                        bInfo.batchNumber,
                        product.id_product,
                        planDate,
                        bInfo.actualStartDatetime || null,
                        bInfo.actualCompletedDatetime || null,
                        currentUserId
                    ]
                );
                batchIdMap.set(compositeKey, insertBatch.insertId);
            }
        }
    }

    // 4. Upsert po_batch_allocations (Akumulasi allocated_qty)
    const updateLogsToInsert = [];
    const insertLogsToInsert = [];

    for (const item of sourceAllocations) {
        const poDetailId = item.poDetailId || item.po_detail_id;
        const batchNumber = item.batchNumber || item.batch_number;
        const itemCode = item.productCode || item.product_code || item.itemCode;
        const compositeKey = `${batchNumber}_${itemCode}`;

        const batchId = item.batchId || batchIdMap.get(compositeKey) || item.id_batch;
        const addedQty = item.addedQty !== undefined ? item.addedQty : (item.addedAllocatedQty || 0);
        let rowStatus = item.rowStatus || item.status || 'Open';

        if (batchNumber) affectedBatchNumbers.add(batchNumber);
        if (!batchId || !poDetailId) continue;

        const [[existingAlloc]] = await connection.query(
            'SELECT id, allocated_qty, status FROM po_batch_allocations WHERE po_detail_id = ? AND id_batch = ? LIMIT 1',
            [poDetailId, batchId]
        );

        if (existingAlloc) {
            const oldAllocatedQty = Number(existingAlloc.allocated_qty || 0);
            const newAllocatedQty = oldAllocatedQty + Number(addedQty);

            // Jangan timpa status jika alokasi di-Force Closed atau Canceled secara manual
            const currentStatus = existingAlloc.status;
            const finalStatus = (currentStatus === 'Force Closed' || currentStatus === 'Canceled')
                ? currentStatus
                : rowStatus;

            updateLogsToInsert.push({
                upload_log_id: uploadLogId,
                allocation_id: existingAlloc.id,
                po_detail_id: poDetailId,
                id_batch: batchId,
                old_allocated_qty: oldAllocatedQty,
                new_allocated_qty: newAllocatedQty,
                old_status: existingAlloc.status,
                new_status: finalStatus,
                created_by: currentUserId
            });

            await connection.query(
                'UPDATE po_batch_allocations SET allocated_qty = ?, status = ?, updated_by = ? WHERE id = ?',
                [newAllocatedQty, finalStatus, currentUserId, existingAlloc.id]
            );
        } else {
            const newAllocatedQty = Number(addedQty);

            const [insertAlloc] = await connection.query(
                `INSERT INTO po_batch_allocations (po_detail_id, id_batch, allocated_qty, status, created_by)
                 VALUES (?, ?, ?, ?, ?)`,
                [poDetailId, batchId, newAllocatedQty, rowStatus, currentUserId]
            );

            insertLogsToInsert.push({
                upload_log_id: uploadLogId,
                allocation_id: insertAlloc.insertId,
                po_detail_id: poDetailId,
                id_batch: batchId,
                allocated_qty: newAllocatedQty,
                status: rowStatus,
                created_by: currentUserId
            });
        }
    }

    if (insertLogsToInsert.length > 0) {
        await logAllocationInsert(connection, insertLogsToInsert, currentUserId);
    }
    if (updateLogsToInsert.length > 0) {
        await logAllocationUpdate(connection, updateLogsToInsert, currentUserId);
    }

    // 5. Update tanggal produksi aktual pada master batches
    for (const bNo of affectedBatchNumbers) {
        await updateBatchProductionDates(connection, bNo, currentUserId);
    }

    // Set untuk menampung SELURUH ID Batch & Header PO yang perlu di-refresh statusnya
    const batchIdsToRefresh = new Set([...batchIdMap.values()].filter(Boolean));
    const poHeaderIds = new Set();

    // 6. Recalculate fulfilled_qty pada po_details & Evaluasi Dua Arah Status Alokasi
    const poDetailIds = [...new Set(sourceAllocations.map(a => a.poDetailId || a.po_detail_id).filter(Boolean))];

    for (const pdId of poDetailIds) {
        // A. Refresh total fulfilled_qty di po_details
        await refreshPODetailFulfilledQty(connection, pdId);

        // B. Cek pemenuhan Qty PO
        const [[poDetailInfo]] = await connection.query(
            `SELECT base_qty, fulfilled_qty, po_header_id FROM po_details WHERE po_detail_id = ?`,
            [pdId]
        );

        if (poDetailInfo) {
            if (poDetailInfo.po_header_id) {
                poHeaderIds.add(poDetailInfo.po_header_id);
            }

            const baseQtyNum = Number(poDetailInfo.base_qty) || 0;
            const fulfilledQtyNum = Number(poDetailInfo.fulfilled_qty) || 0;

            // Tentukan target status alokasi: 'Closed' HANYA JIKA fulfilled_qty === base_qty
            const targetSystemStatus = (fulfilledQtyNum === baseQtyNum) ? 'Closed' : 'Open';

            // Kumpulkan SELURUH batch_id yang terikat dengan po_detail ini untuk memastikan batch lama ikut di-refresh
            const [relatedAllocations] = await connection.query(
                `SELECT id_batch FROM po_batch_allocations WHERE po_detail_id = ?`,
                [pdId]
            );
            relatedAllocations.forEach(alloc => {
                if (alloc.id_batch) {
                    batchIdsToRefresh.add(alloc.id_batch);
                }
            });

            // Update status dua arah untuk alokasi otomatis (abaikan yang Force Closed / Canceled manual)
            await connection.query(
                `UPDATE po_batch_allocations 
                 SET status = ?, updated_by = ? 
                 WHERE po_detail_id = ? AND status IN ('Open', 'Closed')`,
                [targetSystemStatus, currentUserId, pdId]
            );
        }
    }

    // 7. Refresh status Induk Batch (batches) untuk SEMUA ID batch yang terpengaruh
    for (const bId of batchIdsToRefresh) {
        if (bId) await refreshBatchStatus(connection, bId);
    }

    // 8. Refresh status Header PO (po_headers)
    for (const poHeaderId of poHeaderIds) {
        await refreshPOStatus(connection, poHeaderId);
    }

    return { uploadLogId };
};

module.exports = {
    commitProductionAllocationTransaction
};
