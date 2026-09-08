const { sipuroDb: db } = require('../../config/db');
const { parseProductionExcel, calculateFifoAllocation } = require('../../helpers/excelFifoService');
const { refreshPOStatus, refreshBatchStatus, getPOTolerance } = require('../../helpers/batchHelper');

/**
 * Preview Upload Excel Produksi (PPIC)
 */
exports.previewExcelUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Excel file is required.' });
        }

        const { processTimestamp, fileHash, rawRows } = parseProductionExcel(req.file.buffer);

        const [existingLogs] = await db.query(
            'SELECT id, uploaded_at FROM production_upload_logs WHERE process_timestamp = ? OR file_hash = ?',
            [processTimestamp, fileHash]
        );
        const isAlreadyUploaded = existingLogs && existingLogs.length > 0;

        const [existingHashRows] = await db.query(
            'SELECT row_hash FROM production_upload_details'
        );
        const existingHashes = existingHashRows.map(row => row.row_hash);

        // Ambil SEMUA alokasi yang belum dibatalkan (termasuk yang 'Closed') agar baris koreksi minus bisa dicocokkan
        const [targetAllocations] = await db.query(`
            SELECT 
                pba.id AS id_allocation,
                pba.po_detail_id,
                pba.id_batch,
                pba.allocated_qty,
                pba.fulfilled_qty,
                pba.status AS allocation_status,
                pb.batch_number,
                pb.id_product,
                pb.plan_production_date,
                ph.po_number,
                ph.requested_delivery_date,
                ph.created_at,
                p.product_code,
                p.product_name
            FROM po_batch_allocations pba
            JOIN batches pb ON pba.id_batch = pb.id
            JOIN po_details pd ON pba.po_detail_id = pd.po_detail_id
            JOIN po_headers ph ON pd.po_header_id = ph.po_header_id
            JOIN sipuro_db.products p ON pb.id_product = p.id_product
            WHERE pba.status != 'Canceled' AND pb.status != 'Canceled'
            ORDER BY pb.plan_production_date ASC, ph.requested_delivery_date ASC, ph.created_at ASC
        `);

        const [allProducts] = await db.query('SELECT id_product, product_code, product_name FROM sipuro_db.products');
        const poTolerance = await getPOTolerance(db);

        const {
            categorizedDetails,
            summary,
            previewResults,
            unallocatedStocks,
            detailedAllocations
        } = calculateFifoAllocation(
            rawRows,
            existingHashes,
            targetAllocations || [],
            allProducts || [],
            poTolerance
        );

        return res.json({
            success: true,
            data: {
                processTimestamp,
                fileHash,
                fileName: req.file.originalname,
                allocationMode: 'FIFO',
                isReupload: isAlreadyUploaded,
                warningMessage: isAlreadyUploaded ? 'This file or timestamp has been uploaded previously.' : null,
                summary,
                categorizedDetails,
                previewResults,
                unallocatedStocks,
                detailedAllocations
            }
        });

    } catch (error) {
        console.error('Preview Production Upload Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to process Excel file: ' + error.message });
    }
};

/**
 * Commit / Simpan Hasil Alokasi Produksi (PPIC)
 */
exports.commitExcelAllocation = async (req, res) => {
    const {
        processTimestamp,
        fileHash,
        fileName,
        userId,
        allocations = [],
        unallocatedStocks = [],
        newDetails = []
    } = req.body;

    if (!processTimestamp || (allocations.length === 0 && unallocatedStocks.length === 0 && newDetails.length === 0)) {
        return res.status(400).json({ success: false, message: 'Allocation data cannot be empty.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const currentUserId = userId || null;

        // 1. Log upload file produksi
        const [uploadLogResult] = await connection.query(
            'INSERT INTO production_upload_logs (file_name, process_timestamp, file_hash, uploaded_by) VALUES (?, ?, ?, ?)',
            [fileName, processTimestamp, fileHash || null, currentUserId]
        );
        const uploadLogId = uploadLogResult.insertId;

        // 2. Simpan detail baris data baru ke production_upload_details (Termasuk nilai minus)
        if (newDetails && newDetails.length > 0) {
            const detailValues = newDetails.map(detail => [
                uploadLogId,
                detail.batchNumber,
                detail.lotNumber || null,
                detail.itemCode,
                detail.qtyPac || 0,
                detail.actualStartDatetime || null,
                detail.actualCompletedDatetime || null,
                detail.rowHash
            ]);

            await connection.query(
                `INSERT INTO production_upload_details 
                (upload_log_id, batch_number, lot_number, item_code, qty_pac, actual_start_datetime, actual_completed_datetime, row_hash) 
                VALUES ?`,
                [detailValues]
            );
        }

        // 3. Update status & qty fulfilled, serta CATAT LOG DETAIL per baris alokasi PO
        for (const item of allocations) {
            const [[oldData]] = await connection.query(
                'SELECT fulfilled_qty, status FROM po_batch_allocations WHERE id = ?',
                [item.allocationId]
            );

            if (oldData) {
                await connection.query(
                    `INSERT INTO po_batch_allocation_logs (
                        upload_log_id, allocation_id, po_detail_id, id_batch,
                        action_type, old_fulfilled_qty, new_fulfilled_qty,
                        old_status, new_status, created_by
                    ) VALUES (?, ?, ?, ?, 'UPDATE', ?, ?, ?, ?, ?)`,
                    [
                        uploadLogId,
                        item.allocationId,
                        item.poDetailId,
                        item.batchId,
                        oldData.fulfilled_qty || 0,
                        item.fulfilledQty,
                        oldData.status,
                        item.rowStatus,
                        currentUserId
                    ]
                );
            }

            await connection.query(
                'UPDATE po_batch_allocations SET fulfilled_qty = ?, status = ?, updated_by = ? WHERE id = ?',
                [item.fulfilledQty, item.rowStatus, currentUserId, item.allocationId]
            );

            if (item.actDate && item.batchId) {
                await connection.query(
                    'UPDATE batches SET actual_production_date = ?, updated_by = ? WHERE id = ?',
                    [item.actDate, currentUserId, item.batchId]
                );
            }
        }

        // 4. Refresh status Induk Batch (Otomatis Re-Open / Close bergantung kondisi alokasi di dalamnya)
        const batchIds = [...new Set(allocations.map(a => a.batchId).filter(Boolean))];
        for (const bId of batchIds) {
            await refreshBatchStatus(connection, bId);
        }

        // 5. Simpan stok lebihan jika ada
        if (unallocatedStocks && unallocatedStocks.length > 0) {
            for (const stock of unallocatedStocks) {
                if (stock.idProduct && stock.qtyAvailable > 0) {
                    await connection.query(
                        'INSERT INTO unallocated_stocks (batch_number, id_product, qty_available, production_date, created_by) VALUES (?, ?, ?, ?, ?)',
                        [stock.batchNumber, stock.idProduct, stock.qtyAvailable, stock.productionDate, currentUserId]
                    );
                }
            }
        }

        // 6. Update fulfilled_qty di po_details dan Evaluasi Status PO Header
        const poDetailIds = [...new Set(allocations.map(a => a.poDetailId).filter(Boolean))];
        const poHeaderIds = new Set();

        for (const pdId of poDetailIds) {
            await connection.query(
                `UPDATE po_details d
                 SET d.fulfilled_qty = (
                     SELECT COALESCE(SUM(pba.fulfilled_qty), 0)
                     FROM po_batch_allocations pba
                     WHERE pba.po_detail_id = d.po_detail_id
                 )
                 WHERE d.po_detail_id = ?`,
                [pdId]
            );

            const [[pd]] = await connection.query('SELECT po_header_id FROM po_details WHERE po_detail_id = ?', [pdId]);
            if (pd && pd.po_header_id) {
                poHeaderIds.add(pd.po_header_id);
            }
        }

        // 7. Evaluasi perubahan status po_headers
        for (const poHeaderId of poHeaderIds) {
            await refreshPOStatus(connection, poHeaderId);
        }

        await connection.commit();
        return res.json({ success: true, message: 'Production allocation successfully saved to database.' });

    } catch (error) {
        await connection.rollback();
        console.error('Commit Production Allocation Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to save allocation: ' + error.message });
    } finally {
        connection.release();
    }
};
