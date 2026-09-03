const { sipuroDb: db } = require('../../config/db');
const { parseProductionExcel, calculateFifoAllocation } = require('../../helpers/excelFifoService');
const { refreshPOStatus } = require('../../helpers/ppicHelper');

/**
 * Preview Upload Excel Produksi (PPIC)
 * Menerima form-data `file` dan memproses kalkulasi alokasi murni FIFO.
 */
exports.previewExcelUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'File Excel wajib diunggah.' });
        }

        // Parsing file Excel untuk mengambil timestamp dan mapping data per batch
        const { processTimestamp, excelDataMap } = parseProductionExcel(req.file.buffer);

        // Cek log apakah file dengan timestamp ini pernah diunggah sebelumnya
        const [existingLogs] = await db.query(
            'SELECT id, uploaded_at FROM production_upload_logs WHERE process_timestamp = ?',
            [processTimestamp]
        );
        const isAlreadyUploaded = existingLogs && existingLogs.length > 0;

        // Ambil data alokasi PO yang masih Open diurutkan berdasar plan production & delivery date (FIFO)
        const [openAllocations] = await db.query(`
            SELECT 
                pba.id AS id_allocation,
                pba.po_detail_id,
                pba.id_batch,
                pba.allocated_qty,
                pba.fulfilled_qty,
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
            WHERE pba.status = 'Open' AND pb.status = 'Open'
            ORDER BY pb.plan_production_date ASC, ph.requested_delivery_date ASC, ph.created_at ASC
        `);

        // Ambil data referensi produk
        const [allProducts] = await db.query('SELECT id_product, product_code, product_name FROM sipuro_db.products');

        // Kalkulasi alokasi FIFO
        const { previewResults, unallocatedStocks, detailedAllocations } = calculateFifoAllocation(
            excelDataMap,
            openAllocations || [],
            allProducts || []
        );

        return res.json({
            success: true,
            data: {
                processTimestamp,
                fileName: req.file.originalname,
                allocationMode: 'FIFO',
                isReupload: isAlreadyUploaded,
                warningMessage: isAlreadyUploaded ? 'File dengan timestamp ini pernah diunggah sebelumnya.' : null,
                previewResults,
                unallocatedStocks,
                detailedAllocations
            }
        });

    } catch (error) {
        console.error('Preview Production Upload Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal memproses file Excel: ' + error.message });
    }
};

/**
 * Commit / Simpan Hasil Alokasi Produksi (PPIC)
 */
exports.commitExcelAllocation = async (req, res) => {
    const { processTimestamp, fileName, userId, allocations = [], unallocatedStocks = [] } = req.body;

    if (!processTimestamp || (allocations.length === 0 && unallocatedStocks.length === 0)) {
        return res.status(400).json({ success: false, message: 'Data alokasi tidak boleh kosong.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const currentUserId = userId || null;

        // Log upload file produksi
        await connection.query(
            'INSERT INTO production_upload_logs (file_name, process_timestamp, uploaded_by) VALUES (?, ?, ?)',
            [fileName, processTimestamp, currentUserId]
        );

        // 1. Update status, qty fulfilled, & updated_by per baris alokasi PO
        for (const item of allocations) {
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

        // 2. Evaluasi status Batch: Close batch jika SELURUH alokasi PO di dalamnya sudah Close
        const batchIds = [...new Set(allocations.map(a => a.batchId).filter(Boolean))];
        for (const bId of batchIds) {
            const [openRows] = await connection.query(
                'SELECT id FROM po_batch_allocations WHERE id_batch = ? AND status = \'Open\'',
                [bId]
            );
            if (openRows.length === 0) {
                await connection.query(
                    "UPDATE batches SET status = 'Close', updated_by = ? WHERE id = ?", 
                    [currentUserId, bId]
                );
            }
        }

        // 3. Simpan stok lebihan ke tabel unallocated_stocks (dengan created_by)
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

        // 4. Update fulfilled_qty di po_details dan Evaluasi Status PO Header
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

        // 5. Evaluasi perubahan status po_headers
        for (const poHeaderId of poHeaderIds) {
            await refreshPOStatus(connection, poHeaderId);
        }

        await connection.commit();
        return res.json({ success: true, message: 'Alokasi produksi berhasil disimpan ke database.' });

    } catch (error) {
        await connection.rollback();
        console.error('Commit Production Allocation Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan alokasi: ' + error.message });
    } finally {
        connection.release();
    }
};
