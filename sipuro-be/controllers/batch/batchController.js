const { sipuroDb: db } = require('../../config/db');
const { refreshPOStatus } = require('../../helpers/ppicHelper');

/**
 * 1. Ambil daftar batch yang sudah ada berdasarkan Product/SKU (untuk dropdown 'Select Existing Batch')
 */
exports.getExistingBatchesByProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const [batches] = await db.query(
            'SELECT id, batch_number, plan_production_date, status FROM batches WHERE id_product = ? AND status = "Open"',
            [productId]
        );
        return res.json({ success: true, data: batches });
    } catch (error) {
        console.error('Get Batches Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil data batch.' });
    }
};

/**
 * 2. Simpan Pembuatan / Alokasi Batch Baru oleh PPIC (Manual Single)
 */
exports.createBatchAllocation = async (req, res) => {
    const connection = await db.getConnection();
    try {
        // Tangkap userId dari req.body
        const { poDetailId, productId, batchNumber, planProductionDate, allocatedQty, isNewBatch, userId } = req.body;

        if (!poDetailId || !productId || !batchNumber || !allocatedQty) {
            return res.status(400).json({ success: false, message: 'Data alokasi batch tidak lengkap.' });
        }

        const currentUserId = userId || null;

        await connection.beginTransaction();

        let batchId = null;

        if (isNewBatch) {
            const [existing] = await connection.query('SELECT id FROM batches WHERE batch_number = ?', [batchNumber]);
            if (existing.length > 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Kode Batch sudah terdaftar di sistem.' });
            }

            // Tambahkan created_by di tabel batches
            const [batchResult] = await connection.query(
                'INSERT INTO batches (batch_number, id_product, plan_production_date, status, created_by) VALUES (?, ?, ?, "Open", ?)',
                [batchNumber, productId, planProductionDate, currentUserId]
            );
            batchId = batchResult.insertId;
        } else {
            const [existingBatch] = await connection.query('SELECT id FROM batches WHERE batch_number = ?', [batchNumber]);
            if (existingBatch.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Batch existing tidak ditemukan.' });
            }
            batchId = existingBatch[0].id;
        }

        // Tambahkan created_by di tabel po_batch_allocations
        await connection.query(
            'INSERT INTO po_batch_allocations (po_detail_id, id_batch, allocated_qty, fulfilled_qty, status, created_by) VALUES (?, ?, ?, 0, "Open", ?)',
            [poDetailId, batchId, allocatedQty, currentUserId]
        );

        // EVALUASI STATUS PO HEADER SETELAH BUAT BATCH
        const [[pd]] = await connection.query('SELECT po_header_id FROM po_details WHERE po_detail_id = ?', [poDetailId]);
        if (pd && pd.po_header_id) {
            await refreshPOStatus(connection, pd.po_header_id);
        }

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

/**
 * 4. Ambil Daftar Batch/PO Allocations yang Masih 'Open' Berdasarkan SKU Produk
 */
exports.getOpenAllocationsByProduct = async (req, res) => {
    try {
        const { productId } = req.params;

        const [rows] = await db.query(`
            SELECT 
                pba.id AS allocation_id,
                pba.allocated_qty,
                pba.fulfilled_qty,
                (pba.allocated_qty - pba.fulfilled_qty) AS remaining_qty,
                pb.batch_number,
                ph.po_number,
                ph.requested_delivery_date
            FROM po_batch_allocations pba
            JOIN batches pb ON pba.id_batch = pb.id
            JOIN po_details pd ON pba.po_detail_id = pd.po_detail_id
            JOIN po_headers ph ON pd.po_header_id = ph.po_header_id
            WHERE pb.id_product = ? AND pba.status = 'Open' AND pb.status = 'Open'
            ORDER BY ph.requested_delivery_date ASC
        `, [productId]);

        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Get Open Allocations Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengambil alokasi open.' });
    }
};

/**
 * 5. Eksekusi Alokasi Lebihan Stok ke Batch/PO Kurang (Dengan Evaluasi Status 3-Tingkat)
 */
exports.reallocateUnallocatedStock = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { unallocatedId, targetAllocationId, allocateQty, userId } = req.body;

        const qtyToAlloc = parseInt(allocateQty, 10);
        if (!unallocatedId || !targetAllocationId || !qtyToAlloc || qtyToAlloc <= 0) {
            return res.status(400).json({ success: false, message: 'Data alokasi stok tidak valid.' });
        }

        const currentUserId = userId || null;

        await connection.beginTransaction();

        // A. Validasi Stok Lebihan Eksisting
        const [[unallocated]] = await connection.query(
            'SELECT id, qty_available FROM unallocated_stocks WHERE id = ? FOR UPDATE',
            [unallocatedId]
        );

        if (!unallocated || unallocated.qty_available < qtyToAlloc) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Sisa stok lebihan tidak mencukupi.' });
        }

        // B. Validasi Target Allocation (Ambil id_batch & po_detail_id)
        const [[targetAlloc]] = await connection.query(
            'SELECT id, id_batch, po_detail_id, allocated_qty, fulfilled_qty FROM po_batch_allocations WHERE id = ? FOR UPDATE',
            [targetAllocationId]
        );

        if (!targetAlloc) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Target alokasi tidak ditemukan.' });
        }

        const batchId = targetAlloc.id_batch;
        const poDetailId = targetAlloc.po_detail_id;
        const newFulfilledQty = targetAlloc.fulfilled_qty + qtyToAlloc;

        // C. TINGKAT 1: Cek Toleransi 90% untuk Status PO Allocation
        const poRatio = targetAlloc.allocated_qty > 0 ? (newFulfilledQty / targetAlloc.allocated_qty) : 0;
        const newAllocStatus = poRatio >= 0.90 ? 'Close' : 'Open';

        await connection.query(
            'UPDATE po_batch_allocations SET fulfilled_qty = ?, status = ?, updated_by = ? WHERE id = ?',
            [newFulfilledQty, newAllocStatus, currentUserId, targetAllocationId]
        );

        // D. Potong Qty Available Lebihan Stok dan isi updated_by
        const newUnallocatedQty = unallocated.qty_available - qtyToAlloc;
        await connection.query(
            'UPDATE unallocated_stocks SET qty_available = ?, updated_by = ? WHERE id = ?',
            [newUnallocatedQty, currentUserId, unallocatedId]
        );

        // E. TINGKAT 2: Cek Keseluruhan PO Allocation dalam Batch
        const [remainingOpenAllocations] = await connection.query(
            'SELECT COUNT(*) as openCount FROM po_batch_allocations WHERE id_batch = ? AND status = "Open"',
            [batchId]
        );

        const openCount = remainingOpenAllocations[0]?.openCount || 0;
        const newBatchStatus = openCount === 0 ? 'Close' : 'Open';

        await connection.query(
            'UPDATE batches SET status = ?, updated_by = ? WHERE id = ?',
            [newBatchStatus, currentUserId, batchId]
        );

        // F. TINGKAT 3: Evaluasi Presisi Status PO Header (po_headers) via Helper
        const [[pd]] = await connection.query('SELECT po_header_id FROM po_details WHERE po_detail_id = ?', [poDetailId]);
        if (pd && pd.po_header_id) {
            await refreshPOStatus(connection, pd.po_header_id);
        }

        await connection.commit();
        return res.json({ success: true, message: 'Stok lebihan berhasil dialokasikan.' });

    } catch (error) {
        await connection.rollback();
        console.error('Reallocate Stock Error:', error);
        return res.status(500).json({ success: false, message: 'Gagal mengalokasikan stok: ' + error.message });
    } finally {
        connection.release();
    }
};
