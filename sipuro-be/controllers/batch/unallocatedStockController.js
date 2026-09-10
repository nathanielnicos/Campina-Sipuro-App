const { sipuroDb: db } = require('../../config/db');
const { refreshPOStatus, getPOTolerance } = require('../../helpers/batchHelper');

// Mengambil daftar stok kelebihan produksi
exports.getUnallocatedStocks = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (page - 1) * limit;

        // Tangkap parameter query dari frontend
        const { searchStock, prodDate } = req.query;

        let whereClauses = ['us.qty_available > 0'];
        let queryParams = [];

        // Filter Pencarian (No Batch / Kode Produk / Nama Produk)
        if (searchStock && String(searchStock).trim() !== '') {
            whereClauses.push('(us.batch_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ?)');
            const keyword = `%${String(searchStock).trim()}%`;
            queryParams.push(keyword, keyword, keyword);
        }

        // Filter Tanggal Produksi
        if (prodDate && String(prodDate).trim() !== '') {
            whereClauses.push('DATE(us.production_date) = ?');
            queryParams.push(String(prodDate).trim());
        }

        const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

        // Query Count Total Items untuk Pagination
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM unallocated_stocks us
            LEFT JOIN products p ON us.id_product = p.id_product
            ${whereSql}
        `;
        const [countResult] = await db.query(countQuery, queryParams);
        const totalItems = Number(countResult[0]?.total || 0);

        // Query Data Paged
        const dataQuery = `
            SELECT 
                us.id,
                us.batch_number,
                us.id_product,
                us.qty_available,
                us.production_date,
                p.product_code,
                p.product_name
            FROM unallocated_stocks us
            LEFT JOIN products p ON us.id_product = p.id_product
            ${whereSql}
            ORDER BY us.production_date DESC, us.id DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.query(dataQuery, [...queryParams, limit, offset]);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit) || 1,
                totalItems,
                limit
            }
        });
    } catch (error) {
        console.error('Get Unallocated Stocks Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch unallocated stocks.' });
    }
};

// Mengambil daftar po-batch-allocations yang masih "Open" berdasarkan SKU
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
        return res.status(500).json({ success: false, message: 'Failed to fetch open allocations.' });
    }
};

// Mengalokasikan kelebihan produksi ke po-batch yang kurang
exports.reallocateUnallocatedStock = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { unallocatedId, targetAllocationId, allocateQty, userId } = req.body;

        const qtyToAlloc = parseInt(allocateQty, 10);
        if (!unallocatedId || !targetAllocationId || !qtyToAlloc || qtyToAlloc <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid stock allocation data.' });
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
            return res.status(400).json({ success: false, message: 'Insufficient unallocated stock available.' });
        }

        // B. Validasi Target Allocation (Ambil id_batch & po_detail_id)
        const [[targetAlloc]] = await connection.query(
            'SELECT id, id_batch, po_detail_id, allocated_qty, fulfilled_qty FROM po_batch_allocations WHERE id = ? FOR UPDATE',
            [targetAllocationId]
        );

        if (!targetAlloc) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Target allocation not found.' });
        }

        const batchId = targetAlloc.id_batch;
        const poDetailId = targetAlloc.po_detail_id;
        const newFulfilledQty = targetAlloc.fulfilled_qty + qtyToAlloc;

        // C. TINGKAT 1: Cek Toleransi PO Dinamis dari Database company_profile
        const poTolerance = await getPOTolerance(connection);
        const poRatio = targetAlloc.allocated_qty > 0 ? (newFulfilledQty / targetAlloc.allocated_qty) : 0;
        const newAllocStatus = poRatio >= poTolerance ? 'Closed' : 'Open';

        await connection.query(
            'UPDATE po_batch_allocations SET fulfilled_qty = ?, status = ?, updated_by = ? WHERE id = ?',
            [newFulfilledQty, newAllocStatus, currentUserId, targetAllocationId]
        );

        // D. Potong Qty Available Lebihan Stok dan isi updated_by
        const qtyBefore = unallocated.qty_available;
        const newUnallocatedQty = qtyBefore - qtyToAlloc;

        await connection.query(
            'UPDATE unallocated_stocks SET qty_available = ?, updated_by = ? WHERE id = ?',
            [newUnallocatedQty, currentUserId, unallocatedId]
        );

        // --- LOG AUDIT MUTASI STOK ---
        await connection.query(`
            INSERT INTO unallocated_stock_logs 
                (unallocated_stock_id, target_allocation_id, qty_reallocated, qty_before, qty_after, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            unallocatedId,
            targetAllocationId,
            qtyToAlloc,
            qtyBefore,
            newUnallocatedQty,
            currentUserId
        ]);

        // E. TINGKAT 2: Cek Keseluruhan PO Allocation dalam Batch (DIPERBAIKI: Menggunakan placeholder ? untuk nilai 'Open')
        const [remainingOpenAllocations] = await connection.query(
            'SELECT COUNT(*) as openCount FROM po_batch_allocations WHERE id_batch = ? AND status = ?',
            [batchId, 'Open']
        );

        const openCount = remainingOpenAllocations[0]?.openCount || 0;
        const newBatchStatus = openCount === 0 ? 'Closed' : 'Open';

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
        return res.json({ success: true, message: 'Unallocated stock successfully reallocated and logged.' });

    } catch (error) {
        await connection.rollback();
        console.error('Reallocate Stock Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to reallocate stock: ' + error.message });
    } finally {
        connection.release();
    }
};
