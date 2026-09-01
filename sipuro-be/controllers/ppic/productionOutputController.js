const XLSX = require('xlsx');
const { sipuroDb } = require('../../config/db');
const { refreshPOStatus } = require('../../helpers/ppicHelper');

// 1. Preview Output Excel
exports.previewProduction = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'File Excel wajib diunggah.' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        // Map untuk menyimpan akumulasi output berdasarkan gabungan (batchNum + '||' + itemCode)
        const batchOutputMap = {};

        sheetData.forEach((row, idx) => {
            if (idx > 4 && row[1]) {
                const batchNum = String(row[1]).trim();
                const itemCode = String(row[3] || '').trim(); // Kolom D: Item Code SKU
                const qtyCar = parseFloat(row[12] || row[13]) || 0;

                if (batchNum && itemCode && qtyCar > 0) {
                    const key = `${batchNum}||${itemCode}`;
                    batchOutputMap[key] = (batchOutputMap[key] || 0) + qtyCar;
                }
            }
        });

        const previewResults = [];
        const unallocatedStocks = [];

        for (const [compositeKey, actualOutput] of Object.entries(batchOutputMap)) {
            const [batchNum, itemCode] = compositeKey.split('||');

            // Query disaring berdasarkan BATCH NUMBER dan PRODUCT CODE (SKU)
            const [allocations] = await sipuroDb.query(`
                SELECT 
                    b.id AS id_batch,
                    b.batch_number,
                    b.id_product,
                    p.product_code,
                    p.product_name,
                    pba.id AS allocation_id,
                    pba.po_detail_id,
                    pba.allocated_qty,
                    pba.fulfilled_qty AS current_fulfilled,
                    h.po_number,
                    h.po_header_id
                FROM sipuro_db.batches b
                JOIN sipuro_db.products p ON b.id_product = p.id_product
                JOIN sipuro_db.po_batch_allocations pba ON b.id = pba.id_batch
                JOIN sipuro_db.po_details d ON pba.po_detail_id = d.po_detail_id
                JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
                WHERE b.batch_number = ? 
                  AND p.product_code = ?
                  AND b.status = 'Open' 
                  AND pba.status = 'Open'
            `, [batchNum, itemCode]);

            if (allocations.length > 0) {
                const targetQty = allocations.reduce((acc, curr) => acc + Number(curr.allocated_qty), 0);
                const ratio = targetQty > 0 ? actualOutput / targetQty : 0;

                allocations.forEach(alloc => {
                    const calculatedFulfilled = Math.round(alloc.allocated_qty * ratio);
                    previewResults.push({
                        allocation_id: alloc.allocation_id,
                        po_detail_id: alloc.po_detail_id,
                        po_header_id: alloc.po_header_id,
                        id_batch: alloc.id_batch,
                        batch_number: batchNum,
                        po_number: alloc.po_number,
                        product_code: alloc.product_code,
                        product_name: alloc.product_name,
                        allocatedQty: alloc.allocated_qty,
                        fulfilledQty: calculatedFulfilled,
                        rowStatus: calculatedFulfilled >= alloc.allocated_qty ? 'Close' : 'Open'
                    });
                });

                if (actualOutput > targetQty) {
                    unallocatedStocks.push({
                        id_batch: allocations[0].id_batch,
                        batch_number: batchNum,
                        id_product: allocations[0].id_product,
                        product_code: allocations[0].product_code,
                        product_name: allocations[0].product_name,
                        surplusQty: actualOutput - targetQty
                    });
                }
            }
        }

        if (previewResults.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tidak ada batch aktif di DB yang cocok dengan nomor batch dan kode SKU di file Excel ini.'
            });
        }

        res.json({
            success: true,
            message: 'Preview hasil alokasi berhasil diproses.',
            data: {
                processTimestamp: new Date().toISOString(),
                fileName: req.file.originalname,
                previewResults,
                unallocatedStocks
            }
        });

    } catch (error) {
        console.error('Error previewing production:', error);
        res.status(500).json({ success: false, message: 'Gagal membaca file Excel', error: error.message });
    }
};

// 2. Konfirmasi Produksi ke DB
exports.confirmProduction = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { allocations, unallocatedStocks } = req.body;

        if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
            return res.status(400).json({ success: false, message: 'Data alokasi konfirmasi tidak valid.' });
        }

        await connection.beginTransaction();

        const affectedHeaders = new Set();
        const affectedBatches = new Set();

        for (const item of allocations) {
            const addQty = Number(item.fulfilledQty) || 0;

            await connection.query(
                `UPDATE sipuro_db.po_batch_allocations SET fulfilled_qty = fulfilled_qty + ?, status = ? WHERE id = ?`,
                [addQty, item.rowStatus, item.allocation_id]
            );

            await connection.query(
                `UPDATE sipuro_db.po_details SET fulfilled_qty = fulfilled_qty + ? WHERE po_detail_id = ?`,
                [addQty, item.po_detail_id]
            );

            affectedHeaders.add(item.po_header_id);
            affectedBatches.add(item.id_batch);
        }

        if (unallocatedStocks && Array.isArray(unallocatedStocks) && unallocatedStocks.length > 0) {
            for (const stock of unallocatedStocks) {
                await connection.query(
                    `INSERT INTO sipuro_db.unallocated_stocks (id_batch, id_product, qty_available, production_date)
                     VALUES (?, ?, ?, CURDATE())
                     ON DUPLICATE KEY UPDATE qty_available = qty_available + VALUES(qty_available)`,
                    [stock.id_batch, stock.id_product, stock.surplusQty]
                );
            }
        }

        for (const batchId of affectedBatches) {
            const [openAlloc] = await connection.query(
                `SELECT id FROM sipuro_db.po_batch_allocations WHERE id_batch = ? AND status = 'Open'`,
                [batchId]
            );

            if (openAlloc.length === 0) {
                await connection.query(
                    `UPDATE sipuro_db.batches SET status = 'Close', actual_production_date = CURDATE() WHERE id = ?`,
                    [batchId]
                );
            }
        }

        for (const poHeaderId of affectedHeaders) {
            await refreshPOStatus(connection, poHeaderId);
        }

        await connection.commit();
        res.json({ success: true, message: 'Hasil realisasi produksi berhasil disimpan ke database!' });

    } catch (error) {
        await connection.rollback();
        console.error('Error confirming production:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan hasil produksi', error: error.message });
    } finally {
        connection.release();
    }
};
