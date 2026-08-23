const db = require('../config/db');

/**
 * 1. Ambil daftar batch yang sudah ada berdasarkan Product/SKU (untuk dropdown 'Select Existing Batch')
 */
exports.getExistingBatchesByProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const [batches] = await db.query(
            'SELECT id, batch_number, plan_production_date, status FROM po_batches WHERE id_product = ? AND status = "Open"',
            [productId]
        );
        return res.json({ success: true, data: batches });
    } catch (error) {
        console.error('Get Batches Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data batch.' });
    }
};

/**
 * 2. Simpan Pembuatan / Alokasi Batch Baru oleh PPIC
 */
exports.createBatchAllocation = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { poDetailId, productId, batchNumber, planProductionDate, allocatedQty, isNewBatch } = req.body;

        if (!poDetailId || !productId || !batchNumber || !allocatedQty) {
            return res.status(400).json({ success: false, message: 'Data alokasi batch tidak lengkap.' });
        }

        await connection.beginTransaction();

        let batchId = null;

        if (isNewBatch) {
            // A. Jika buat Batch baru, pastikan kode batch belum dipakai
            const [existing] = await connection.query('SELECT id FROM po_batches WHERE batch_number = ?', [batchNumber]);
            if (existing.length > 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Kode Batch sudah terdaftar di sistem.' });
            }

            const [batchResult] = await connection.query(
                'INSERT INTO po_batches (batch_number, id_product, plan_production_date, status) VALUES (?, ?, ?, "Open")',
                [batchNumber, productId, planProductionDate]
            );
            batchId = batchResult.insertId;
        } else {
            // B. Jika pilih Batch existing
            const [existingBatch] = await connection.query('SELECT id FROM po_batches WHERE batch_number = ?', [batchNumber]);
            if (existingBatch.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Batch existing tidak ditemukan.' });
            }
            batchId = existingBatch[0].id;
        }

        // C. Simpan ke Pivot Alokasi `po_batch_allocations`
        await connection.query(
            'INSERT INTO po_batch_allocations (po_detail_id, id_batch, allocated_qty, fulfilled_qty, status) VALUES (?, ?, ?, 0, "Open")',
            [poDetailId, batchId, allocatedQty]
        );

        await connection.commit();
        return res.json({ success: true, message: 'Berhasil mengalokasikan batch ke item PO.' });

    } catch (error) {
        await connection.rollback();
        console.error('Create Batch Allocation Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengalokasikan batch: ' + error.message });
    } finally {
        connection.release();
    }
};
