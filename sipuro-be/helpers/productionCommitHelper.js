const {
    refreshPOStatus,
    refreshBatchStatus,
    refreshPODetailFulfilledQty,
    updateBatchProductionDates
} = require('./batchHelper');
const { logAllocationInsert, logAllocationUpdate } = require('./poBatchAllocationLogHelper');
const { logUnallocatedStock } = require('./unallocatedStockLogHelper');

/**
 * Helper untuk commit data alokasi dan master terkait ke database
 */
const commitProductionAllocationTransaction = async (connection, {
    fileName,
    processTimestamp,
    fileHash,
    userId,
    allocations = [],
    unallocatedStocks = [],
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

    // 2. Insert detail baris data mentah Excel ke production_upload_details
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

    // 3. Auto-create atau Find-or-Create Master Batch
    const batchIdMap = new Map();
    const uniqueBatchData = new Map();

    newDetails.forEach(d => {
        if (d.batchNumber && !uniqueBatchData.has(d.batchNumber)) {
            uniqueBatchData.set(d.batchNumber, {
                batchNumber: d.batchNumber,
                itemCode: d.itemCode,
                actualStartDatetime: d.actualStartDatetime,
                actualCompletedDatetime: d.actualCompletedDatetime
            });
        }
    });

    for (const [bNo, bInfo] of uniqueBatchData.entries()) {
        const [[existingBatch]] = await connection.query(
            'SELECT id, id_product FROM batches WHERE batch_number = ? LIMIT 1',
            [bNo]
        );

        if (existingBatch) {
            batchIdMap.set(bNo, existingBatch.id);
        } else {
            const [[product]] = await connection.query(
                'SELECT id_product FROM sipuro_db.products WHERE product_code = ? LIMIT 1',
                [bInfo.itemCode]
            );

            if (product) {
                const planDate = bInfo.actualStartDatetime
                    ? bInfo.actualStartDatetime.split(' ')[0]
                    : new Date().toISOString().split('T')[0];

                const [insertBatch] = await connection.query(
                    `INSERT INTO batches (batch_number, id_product, plan_production_date, actual_production_date, actual_completed_date, status, created_by)
                     VALUES (?, ?, ?, ?, ?, 'Open', ?)`,
                    [
                        bNo,
                        product.id_product,
                        planDate,
                        bInfo.actualStartDatetime || null,
                        bInfo.actualCompletedDatetime || null,
                        currentUserId
                    ]
                );
                batchIdMap.set(bNo, insertBatch.insertId);
            }
        }
    }

    // 4. Upsert po_batch_allocations (Tambah/Kurang Qty & Log Aktivitas)
    const updateLogsToInsert = [];
    const insertLogsToInsert = [];
    const sourceAllocations = detailedAllocations.length > 0 ? detailedAllocations : allocations;

    for (const item of sourceAllocations) {
        const poDetailId = item.poDetailId || item.po_detail_id;
        const batchNumber = item.batchNumber || item.batch_number;
        const batchId = item.batchId || batchIdMap.get(batchNumber) || item.id_batch;
        const addedQty = item.addedQty !== undefined ? item.addedQty : (item.addedAllocatedQty || 0);
        const rowStatus = item.rowStatus || item.status || 'Open';

        if (batchNumber) affectedBatchNumbers.add(batchNumber);
        if (!batchId || !poDetailId) continue;

        const [[existingAlloc]] = await connection.query(
            'SELECT id, allocated_qty, status FROM po_batch_allocations WHERE po_detail_id = ? AND id_batch = ? LIMIT 1',
            [poDetailId, batchId]
        );

        if (existingAlloc) {
            const oldQty = Number(existingAlloc.allocated_qty || 0);
            const newAllocQty = oldQty + Number(addedQty);

            updateLogsToInsert.push({
                upload_log_id: uploadLogId,
                allocation_id: existingAlloc.id,
                po_detail_id: poDetailId,
                id_batch: batchId,
                old_fulfilled_qty: oldQty,
                new_fulfilled_qty: newAllocQty,
                old_status: existingAlloc.status,
                new_status: rowStatus,
                created_by: currentUserId
            });

            await connection.query(
                'UPDATE po_batch_allocations SET allocated_qty = ?, status = ?, updated_by = ? WHERE id = ?',
                [newAllocQty, rowStatus, currentUserId, existingAlloc.id]
            );
        } else {
            const newAllocQty = Number(addedQty);

            const [insertAlloc] = await connection.query(
                `INSERT INTO po_batch_allocations (po_detail_id, id_batch, allocated_qty, fulfilled_qty, status, created_by)
                 VALUES (?, ?, ?, 0, ?, ?)`,
                [poDetailId, batchId, newAllocQty, rowStatus, currentUserId]
            );

            insertLogsToInsert.push({
                upload_log_id: uploadLogId,
                allocation_id: insertAlloc.insertId,
                po_detail_id: poDetailId,
                id_batch: batchId,
                fulfilled_qty: newAllocQty,
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

    // 6. Refresh status batch
    const batchIdsToRefresh = new Set([...batchIdMap.values()]);
    for (const bId of batchIdsToRefresh) {
        if (bId) await refreshBatchStatus(connection, bId);
    }

    // 7. Simpan unallocated stock (sisa Qty produksi tak teralokasi)
    if (unallocatedStocks && unallocatedStocks.length > 0) {
        const unallocatedLogsToInsert = [];
        for (const stock of unallocatedStocks) {
            const bNo = stock.batchNumber || stock.batch_number;
            const idProd = stock.idProduct || stock.id_product;
            const qtyAvail = stock.qtyAvailable !== undefined ? stock.qtyAvailable : stock.qty_available;

            if (idProd && qtyAvail > 0) {
                const [[bDates]] = await connection.query(`
                    SELECT actual_production_date, actual_completed_date 
                    FROM batches 
                    WHERE batch_number = ? LIMIT 1
                `, [bNo]);

                const actStart = bDates?.actual_production_date || stock.actualStartDatetime || null;
                const actEnd = bDates?.actual_completed_date || stock.actualCompletedDatetime || null;

                const [insertUnallocResult] = await connection.query(
                    `INSERT INTO unallocated_stocks 
                    (batch_number, id_product, qty_available, actual_production_date, actual_completed_date, created_by) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [bNo, idProd, qtyAvail, actStart, actEnd, currentUserId]
                );

                unallocatedLogsToInsert.push({
                    unallocatedStockId: insertUnallocResult.insertId,
                    targetAllocationId: null,
                    actionType: 'CREATE',
                    qtyReallocated: 0,
                    qtyBefore: 0,
                    qtyAfter: qtyAvail
                });
            }
        }
        if (unallocatedLogsToInsert.length > 0) {
            await logUnallocatedStock(connection, unallocatedLogsToInsert, currentUserId);
        }
    }

    // 8. Recalculate fulfilled_qty pada po_details & refresh status PO header
    const poDetailIds = [...new Set(sourceAllocations.map(a => a.poDetailId || a.po_detail_id).filter(Boolean))];
    const poHeaderIds = new Set();

    for (const pdId of poDetailIds) {
        await refreshPODetailFulfilledQty(connection, pdId);
        const [[pd]] = await connection.query('SELECT po_header_id FROM po_details WHERE po_detail_id = ?', [pdId]);
        if (pd && pd.po_header_id) {
            poHeaderIds.add(pd.po_header_id);
        }
    }

    for (const poHeaderId of poHeaderIds) {
        await refreshPOStatus(connection, poHeaderId);
    }

    return { uploadLogId };
};

module.exports = {
    commitProductionAllocationTransaction
};
