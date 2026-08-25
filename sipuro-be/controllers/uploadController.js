const { sipuroDb: db } = require('../config/db');
const { parseProductionExcel, calculateFifoAllocation } = require('../helpers/excelFifoService');
const { refreshPOStatus } = require('../helpers/ppicHelper');

/**
 * 1. API Preview Upload Excel (POST /api/upload/preview)
 */
exports.previewExcelUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'File Excel wajib diunggah.' });
        }

        // A. Parse File Excel
        const { processTimestamp, excelDataMap } = parseProductionExcel(req.file.buffer);

        // B. Cek Duplikasi Timestamp di Log Upload
        const [existingLogs] = await db.query(
            'SELECT id, uploaded_at FROM production_upload_logs WHERE process_timestamp = ?',
            [processTimestamp]
        );
        const isAlreadyUploaded = existingLogs && existingLogs.length > 0;

        // C. Ambil Seluruh Row Alokasi Batch yang berstatus 'Open' dari DB (Urut FIFO)
        const [openAllocations] = await db.query(`
            SELECT 
                pba.id AS id_allocation,
                pba.po_detail_id,
                pba.id_batch,
                pba.allocated_qty,
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
            JOIN campina_db.products p ON pb.id_product = p.id_product
            WHERE pba.status = 'Open' AND pb.status = 'Open'
            ORDER BY pb.plan_production_date ASC, ph.requested_delivery_date ASC, ph.created_at ASC
        `);

        // C2. Ambil Master seluruh produk sebagai Fallback Nama Produk
        const [allProducts] = await db.query('SELECT id_product, product_code, product_name FROM campina_db.products');

        // D. Jalankan Kalkulasi FIFO Pro-rata dengan mengirim data Master Produk
        const { previewResults, unallocatedStocks } = calculateFifoAllocation(
            excelDataMap,
            openAllocations || [],
            allProducts || []
        );

        return res.json({
            success: true,
            data: {
                processTimestamp,
                fileName: req.file.originalname,
                isReupload: isAlreadyUploaded,
                warningMessage: isAlreadyUploaded
                    ? 'File ini pernah diunggah sebelumnya. Hanya baris/batch baru yang belum di-close yang akan diproses.'
                    : null,
                previewResults,
                unallocatedStocks
            }
        });

    } catch (error) {
        console.error('Preview Upload Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal memproses file Excel: ' + error.message });
    }
};

/**
 * 2. API Commit / Simpan Hasil Alokasi (POST /api/upload/commit)
 */
exports.commitExcelAllocation = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { processTimestamp, fileName, userId, allocations = [], unallocatedStocks = [] } = req.body;

        await connection.beginTransaction();

        // A. Simpan Log Upload
        await connection.query(
            'INSERT INTO production_upload_logs (file_name, process_timestamp, uploaded_by) VALUES (?, ?, ?)',
            [fileName, processTimestamp, userId || null]
        );

        // B. Update Pivot Alokasi & Tanggal Aktual Batch
        for (const item of allocations) {
            await connection.query(
                'UPDATE po_batch_allocations SET fulfilled_qty = ?, status = ? WHERE id = ?',
                [item.fulfilledQty, item.rowStatus, item.allocationId]
            );

            if (item.actDate) {
                await connection.query(
                    'UPDATE batches SET actual_production_date = ? WHERE id = ?',
                    [item.actDate, item.batchId]
                );
            }
        }

        // C. Evaluasi & Update Status Batch Utama (`batches`) menjadi 'Close' jika semua row-nya 'Close'
        const batchIds = [...new Set(allocations.map(a => a.batchId))];
        for (const bId of batchIds) {
            const [openRows] = await connection.query(
                'SELECT id FROM po_batch_allocations WHERE id_batch = ? AND status = "Open"',
                [bId]
            );
            if (openRows.length === 0) {
                await connection.query('UPDATE batches SET status = "Close" WHERE id = ?', [bId]);
            }
        }

        // D. Simpan Kelebihan Stock ke `unallocated_stocks`
        if (unallocatedStocks && unallocatedStocks.length > 0) {
            for (const stock of unallocatedStocks) {
                if (!stock.isNewUnregisteredBatch) {
                    await connection.query(
                        'INSERT INTO unallocated_stocks (batch_number, id_product, qty_available, production_date) VALUES (?, ?, ?, ?)',
                        [stock.batchNumber, stock.idProduct, stock.qtyAvailable, stock.productionDate]
                    );
                }
            }
        }

        // E. Evaluasi & Auto-Update Presisi Status PO Header via Helper Terpusat
        const poDetailIds = [...new Set(allocations.map(a => a.poDetailId))];
        const poHeaderIds = new Set();

        for (const pdId of poDetailIds) {
            const [[pd]] = await connection.query('SELECT po_header_id FROM po_details WHERE po_detail_id = ?', [pdId]);
            if (pd && pd.po_header_id) {
                poHeaderIds.add(pd.po_header_id);
            }
        }

        for (const poHeaderId of poHeaderIds) {
            await refreshPOStatus(connection, poHeaderId);
        }

        await connection.commit();
        return res.json({ success: true, message: 'Alokasi produksi berhasil disimpan ke database.' });

    } catch (error) {
        await connection.rollback();
        console.error('Commit Allocation Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan alokasi: ' + error.message });
    } finally {
        connection.release();
    }
};
