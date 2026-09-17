const { sipuroDb: db } = require('../../config/db');
const { refreshPOStatus, getPOTolerance } = require('../../helpers/batchHelper');
const { logUnallocatedStock } = require('../../helpers/unallocatedStockLogHelper');

// Mengambil daftar stok kelebihan produksi
exports.getUnallocatedStocks = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
        const offset = (page - 1) * limit;

        // Tangkap parameter query dari frontend
        const {
            searchStock,
            fromProdDate,
            toProdDate,
            fromCompDate,
            toCompDate,
            sortKey,
            sortOrder
        } = req.query;

        let whereClauses = ['us.qty_available > 0'];
        let queryParams = [];

        // Filter Pencarian (No Batch / Kode Produk / Nama Produk)
        if (searchStock && String(searchStock).trim() !== '') {
            whereClauses.push('(us.batch_number LIKE ? OR p.product_code LIKE ? OR p.product_name LIKE ?)');
            const keyword = `%${String(searchStock).trim()}%`;
            queryParams.push(keyword, keyword, keyword);
        }

        // Filter Rentang Tanggal Mulai Produksi (actual_production_date)
        if (fromProdDate && String(fromProdDate).trim() !== '') {
            whereClauses.push('us.actual_production_date >= ?');
            queryParams.push(`${fromProdDate.trim()} 00:00:00`);
        }
        if (toProdDate && String(toProdDate).trim() !== '') {
            whereClauses.push('us.actual_production_date <= ?');
            queryParams.push(`${toProdDate.trim()} 23:59:59`);
        }

        // Filter Rentang Tanggal Selesai Produksi (actual_completed_date)
        if (fromCompDate && String(fromCompDate).trim() !== '') {
            whereClauses.push('us.actual_completed_date >= ?');
            queryParams.push(`${fromCompDate.trim()} 00:00:00`);
        }
        if (toCompDate && String(toCompDate).trim() !== '') {
            whereClauses.push('us.actual_completed_date <= ?');
            queryParams.push(`${toCompDate.trim()} 23:59:59`);
        }

        const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

        // Mapping aman untuk ORDER BY (Mencegah SQL Injection)
        const allowedSortKeys = {
            batch_number: 'us.batch_number',
            product_code: 'p.product_code',
            product_name: 'p.product_name',
            actual_production_date: 'us.actual_production_date',
            actual_completed_date: 'us.actual_completed_date',
            qty_available: 'us.qty_available'
        };

        const targetSortColumn = allowedSortKeys[sortKey] || 'us.actual_production_date';
        const targetSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const orderBySql = `ORDER BY ${targetSortColumn} ${targetSortOrder}, us.id DESC`;

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
                us.actual_production_date,
                us.actual_completed_date,
                p.product_code,
                p.product_name
            FROM unallocated_stocks us
            LEFT JOIN products p ON us.id_product = p.id_product
            ${whereSql}
            ${orderBySql}
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

        // B. Validasi Target Allocation
        const [[targetAlloc]] = await connection.query(
            'SELECT id, id_batch, po_detail_id, allocated_qty, fulfilled_qty FROM po_batch_allocations WHERE id = ? FOR UPDATE',
            [targetAllocationId]
        );

        if (!targetAlloc) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Target allocation not found.' });
        }

        // VALIDASI TAMBAHAN: Cek sisa kebutuhan target alokasi
        const remainingTargetQty = targetAlloc.allocated_qty - targetAlloc.fulfilled_qty;
        if (qtyToAlloc > remainingTargetQty) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Allocation quantity (${qtyToAlloc} Pcs) exceeds target remaining requirement (${remainingTargetQty} Pcs).`
            });
        }

        const batchId = targetAlloc.id_batch;
        const poDetailId = targetAlloc.po_detail_id;
        const newFulfilledQty = targetAlloc.fulfilled_qty + qtyToAlloc;

        // C. TINGKAT 1: Cek Toleransi PO Dinamis
        const poTolerance = await getPOTolerance(connection);
        const poRatio = targetAlloc.allocated_qty > 0 ? (newFulfilledQty / targetAlloc.allocated_qty) : 0;
        const newAllocStatus = poRatio >= poTolerance ? 'Closed' : 'Open';

        await connection.query(
            'UPDATE po_batch_allocations SET fulfilled_qty = ?, status = ?, updated_by = ? WHERE id = ?',
            [newFulfilledQty, newAllocStatus, currentUserId, targetAllocationId]
        );

        // D. Potong Qty Available Lebihan Stok
        const qtyBefore = unallocated.qty_available;
        const newUnallocatedQty = qtyBefore - qtyToAlloc;

        await connection.query(
            'UPDATE unallocated_stocks SET qty_available = ?, updated_by = ? WHERE id = ?',
            [newUnallocatedQty, currentUserId, unallocatedId]
        );

        // LOG AUDIT MUTASI STOK (Menggunakan Helper)
        await logUnallocatedStock(connection, {
            unallocatedStockId: unallocatedId,
            targetAllocationId: targetAllocationId,
            actionType: 'REALLOCATE',
            qtyReallocated: qtyToAlloc,
            qtyBefore: qtyBefore,
            qtyAfter: newUnallocatedQty
        }, currentUserId);

        // E. TINGKAT 2: Cek Keseluruhan PO Allocation dalam Batch
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

        // F. TINGKAT 3: Evaluasi Status PO Header
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
