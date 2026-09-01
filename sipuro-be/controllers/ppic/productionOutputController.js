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

        // Map untuk menampung akumulasi Excel: { compositeKey: { qty: totalQty, actDate: latestDate } }
        const batchOutputMap = {};

        sheetData.forEach((row, idx) => {
            // Membaca data mulai baris ke-7 (index 6, di bawah header tabel Excel)
            if (idx >= 6 && row[1]) {
                const batchNum = String(row[1] || '').trim();  // Kolom B
                const itemCode = String(row[5] || '').trim();  // Kolom F
                const qtyVal = parseFloat(row[12]) || 0;       // Kolom M
                const rawDate = row[14] ? String(row[14]).trim() : ''; // Kolom O

                if (batchNum && itemCode && qtyVal !== 0) {
                    const key = `${batchNum}||${itemCode}`;

                    if (!batchOutputMap[key]) {
                        batchOutputMap[key] = { qty: 0, actDate: null };
                    }

                    batchOutputMap[key].qty += qtyVal;
                    if (rawDate) {
                        batchOutputMap[key].actDate = rawDate;
                    }
                }
            }
        });

        const previewResults = [];
        let registeredCount = 0;
        let unregisteredCount = 0;

        // Iterasi HANYA baris-baris yang ada di Excel
        for (const [compositeKey, data] of Object.entries(batchOutputMap)) {
            const actualOutput = data.qty;
            if (actualOutput <= 0) continue;

            const [batchNum, itemCode] = compositeKey.split('||');

            // Cek Alokasi PO yang cocok dengan Batch DAN SKU di DB
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
                    pba.plan_date,
                    h.po_number,
                    h.po_header_id
                FROM sipuro_db.po_batch_allocations pba
                JOIN sipuro_db.batches b ON pba.id_batch = b.id
                JOIN sipuro_db.products p ON b.id_product = p.id_product
                JOIN sipuro_db.po_details d ON pba.po_detail_id = d.po_detail_id
                JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
                WHERE b.batch_number = ? 
                  AND p.product_code = ?
                  AND b.status = 'Open' 
                  AND pba.status = 'Open'
            `, [batchNum, itemCode]);

            if (allocations.length > 0) {
                // KATEGORI: TERDAFTAR (Ada di Alokasi PO)
                registeredCount++;
                let remainingOutput = actualOutput;

                allocations.forEach(alloc => {
                    const currentFulfilled = Number(alloc.current_fulfilled) || 0;
                    const neededQty = alloc.allocated_qty - currentFulfilled;
                    let targetTotalFulfilled = currentFulfilled;

                    if (remainingOutput > 0) {
                        if (remainingOutput >= neededQty) {
                            targetTotalFulfilled = alloc.allocated_qty;
                            remainingOutput -= neededQty;
                        } else {
                            targetTotalFulfilled = currentFulfilled + remainingOutput;
                            remainingOutput = 0;
                        }
                    }

                    previewResults.push({
                        status: 'TERDAFTAR',
                        allocation_id: alloc.allocation_id,
                        po_detail_id: alloc.po_detail_id,
                        po_header_id: alloc.po_header_id,
                        id_batch: alloc.id_batch,
                        batchNumber: batchNum,
                        poNumber: alloc.po_number,
                        productCode: alloc.product_code,
                        productName: alloc.product_name,
                        planDate: alloc.plan_date || null,
                        actDate: data.actDate || new Date().toISOString().split('T')[0],
                        allocatedQty: alloc.allocated_qty,
                        fulfilledQty: targetTotalFulfilled, // Menampilkan total kumulatif setelah penambahan
                        rowStatus: targetTotalFulfilled >= alloc.allocated_qty ? 'Close' : 'Open',
                        notes: '-'
                    });
                });
            } else {
                // KATEGORI: TIDAK TERDAFTAR (Cek Alasan Ketidaksesuaian)
                unregisteredCount++;

                // 1. Cek Batch di DB
                const [batchExist] = await sipuroDb.query(
                    `SELECT id FROM sipuro_db.batches WHERE batch_number = ?`,
                    [batchNum]
                );
                // 2. Cek SKU di DB
                const [productExist] = await sipuroDb.query(
                    `SELECT id_product, product_name FROM sipuro_db.products WHERE product_code = ?`,
                    [itemCode]
                );

                let reason = '';
                if (!batchExist.length && !productExist.length) {
                    reason = 'Batch & SKU tidak terdaftar di DB';
                } else if (!batchExist.length) {
                    reason = 'Nomor Batch tidak terdaftar di DB';
                } else if (!productExist.length) {
                    reason = 'Kode SKU tidak terdaftar di DB';
                } else {
                    reason = 'Tidak ada alokasi PO aktif untuk Batch/SKU ini';
                }

                previewResults.push({
                    status: 'TIDAK_TERDAFTAR',
                    allocation_id: null,
                    po_detail_id: null,
                    po_header_id: null,
                    id_batch: batchExist.length > 0 ? batchExist[0].id : null,
                    batchNumber: batchNum,
                    poNumber: '-',
                    productCode: itemCode,
                    productName: productExist.length > 0 ? productExist[0].product_name : '-',
                    planDate: null,
                    actDate: data.actDate || new Date().toISOString().split('T')[0],
                    allocatedQty: 0,
                    fulfilledQty: actualOutput,
                    rowStatus: '-',
                    notes: reason
                });
            }
        }

        return res.json({
            success: true,
            message: 'Preview hasil alokasi berhasil diproses.',
            data: {
                processTimestamp: new Date().toLocaleString('id-ID'),
                fileName: req.file.originalname,
                summary: {
                    total: previewResults.length,
                    registeredCount,
                    unregisteredCount
                },
                previewResults
            }
        });

    } catch (error) {
        console.error('Error previewing production:', error);
        return res.status(500).json({ success: false, message: 'Gagal membaca file Excel', error: error.message });
    }
};

// 2. Konfirmasi Produksi ke DB
exports.confirmProduction = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { allocations } = req.body;

        // Filter HANYA data yang TERDAFTAR untuk disimpan ke DB
        const validAllocations = (allocations || []).filter(item => item.status === 'TERDAFTAR');

        if (validAllocations.length === 0) {
            return res.status(400).json({ success: false, message: 'Tidak ada data Terdaftar yang dapat disimpan.' });
        }

        await connection.beginTransaction();

        const affectedHeaders = new Set();
        const affectedDetails = new Set();
        const affectedBatches = new Set();

        for (const item of validAllocations) {
            const totalFulfilled = Number(item.fulfilledQty) || 0;

            // Mengupdate langsung nilai total kumulatif akhir dari preview ke database
            await connection.query(
                `UPDATE sipuro_db.po_batch_allocations SET fulfilled_qty = ?, status = ? WHERE id = ?`,
                [totalFulfilled, item.rowStatus, item.allocation_id]
            );

            affectedDetails.add(item.po_detail_id);
            affectedHeaders.add(item.po_header_id);
            affectedBatches.add(item.id_batch);
        }

        // Recalculate total fulfilled_qty di po_details dari SUM alokasi batch
        for (const poDetailId of affectedDetails) {
            await connection.query(
                `UPDATE sipuro_db.po_details d
                 SET d.fulfilled_qty = (
                     SELECT COALESCE(SUM(pba.fulfilled_qty), 0)
                     FROM sipuro_db.po_batch_allocations pba
                     WHERE pba.po_detail_id = d.po_detail_id
                 )
                 WHERE d.po_detail_id = ?`,
                [poDetailId]
            );
        }

        // Update status Batch jika seluruh alokasinya sudah Close
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

        // Refresh status Header PO
        for (const poHeaderId of affectedHeaders) {
            await refreshPOStatus(connection, poHeaderId);
        }

        await connection.commit();
        return res.json({ success: true, message: 'Hasil realisasi produksi berhasil disimpan ke database!' });

    } catch (error) {
        await connection.rollback();
        console.error('Error confirming production:', error);
        return res.status(500).json({ success: false, message: 'Gagal menyimpan hasil produksi', error: error.message });
    } finally {
        connection.release();
    }
};
