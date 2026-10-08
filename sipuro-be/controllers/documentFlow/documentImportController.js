const { generateFileHash } = require('../../helpers/upload-document-flow/hashGeneratorHelper');
const { parseDocumentFlowExcel } = require('../../helpers/upload-document-flow/excelParserHelper');
const { allocateFifoBatch } = require('../../helpers/upload-document-flow/fifoMatcherHelper');

// 1. Preview Process (Tidak menulis ke database transaksi utama)
const previewImport = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File required' });

        const fileBuffer = req.file.buffer;
        const fileHash = generateFileHash(fileBuffer);

        // Cek apakah file sudah pernah diimpor sebelumnya
        const [existingLog] = await req.db.query(
            'SELECT id FROM document_import_logs WHERE file_hash = ?',
            [fileHash]
        );
        if (existingLog.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate File: Document Excel ini sudah pernah diimpor.'
            });
        }

        const { parsedData, unregisteredSKUs } = await parseDocumentFlowExcel(fileBuffer, req.db);

        // Pencocokan Alokasi FIFO awal untuk preview
        for (let item of parsedData) {
            if (item.candidatePOs.length > 0) {
                const matchedBatch = await allocateFifoBatch(req.db, {
                    productId: item.productId,
                    qtyNeeded: item.qtyCtnDO,
                    candidatePOs: item.candidatePOs
                });
                item.matchedBatch = matchedBatch;
            }
        }

        return res.json({
            success: true,
            fileHash,
            fileName: req.file.originalname,
            summary: {
                totalRowsParsed: parsedData.length,
                unregisteredSKUsCount: unregisteredSKUs.length
            },
            unregisteredSKUs,
            previewData: parsedData
        });
    } catch (err) {
        console.error('Error Preview Import:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 2. Commit Transaction (Simpan Data Atomic dengan DB Transaction)
const commitImport = async (req, res) => {
    const connection = await req.db.getConnection();
    try {
        await connection.beginTransaction();

        const { fileName, fileHash, items, uploadedBy } = req.body;

        // Save Header Import Log
        const [logResult] = await connection.query(
            'INSERT INTO document_import_logs (file_name, file_hash, uploaded_by) VALUES (?, ?, ?)',
            [fileName, fileHash, uploadedBy || 'System']
        );
        const importLogId = logResult.insertId;

        for (let item of items) {
            let insertedDOId = null;

            // Commit DO jika memilik nomor DO
            if (item.doNumber) {
                const [doResult] = await connection.query(
                    `INSERT INTO delivery_orders 
                     (import_log_id, po_batch_allocation_id, po_number, do_number, do_created_date, pick_up_date, product_id, qty_ctn, qty_pcs, row_hash) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        importLogId,
                        item.matchedBatch ? item.matchedBatch.id : null,
                        item.matchedBatch ? item.matchedBatch.po_number : (item.candidatePOs[0] || null),
                        item.doNumber,
                        item.doCreatedDate ? new Date(item.doCreatedDate) : null,
                        item.pickUpDate ? new Date(item.pickUpDate) : null,
                        item.productId,
                        item.qtyCtnDO,
                        item.qtyPcsDO,
                        item.rowHashDO
                    ]
                );
                insertedDOId = doResult.insertId;
            }

            // Commit SI jika memilik nomor SI
            if (item.siNumber) {
                await connection.query(
                    `INSERT INTO sales_invoices 
                     (import_log_id, delivery_order_id, do_number, si_number, si_date, pick_up_date, product_id, qty_ctn, qty_pcs, row_hash) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        importLogId,
                        insertedDOId,
                        item.doNumber || '',
                        item.siNumber,
                        item.siDate ? new Date(item.siDate) : null,
                        item.pickUpDate ? new Date(item.pickUpDate) : null,
                        item.productId,
                        item.qtyCtnSI,
                        item.qtyPcsSI,
                        item.rowHashSI
                    ]
                );
            }
        }

        await connection.commit();
        return res.json({ success: true, message: 'Data berhasil disimpan.', importLogId });
    } catch (err) {
        await connection.rollback();
        console.error('Error Commit Import:', err);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan data: ' + err.message });
    } finally {
        connection.release();
    }
};

module.exports = { previewImport, commitImport };
