const XLSX = require('xlsx');
const { sipuroDb } = require('../config/db');
const { refreshPOStatus, AUTO_CLOSE_THRESHOLD_PERCENT } = require('../helpers/ppicHelper');

exports.allocateBatch = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { po_detail_id, batch_code, production_date, expired_date, allocated_qty, created_by } = req.body;
        if (!po_detail_id || !batch_code || !production_date || !allocated_qty || !created_by) {
            return res.status(400).json({ success: false, message: 'Data alokasi tidak lengkap.' });
        }

        await connection.beginTransaction();

        const [detailRows] = await connection.query(
            `SELECT d.po_header_id, d.id_product, d.base_qty, h.status AS po_status
             FROM sipuro_db.po_details d
             JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
             WHERE d.po_detail_id = ? AND d.deleted_at IS NULL`,
            [po_detail_id]
        );

        if (detailRows.length === 0) return res.status(404).json({ success: false, message: 'Item PO Detail tidak ditemukan.' });

        const { po_header_id, id_product, base_qty } = detailRows[0];

        const [existingAlloc] = await connection.query(
            `SELECT SUM(allocated_qty) AS current_alloc FROM sipuro_db.po_batch_allocations WHERE po_detail_id = ? AND status = 'Active'`,
            [po_detail_id]
        );
        const currentAllocated = existingAlloc[0].current_alloc || 0;
        const remainingQty = base_qty - currentAllocated;

        if (parseInt(allocated_qty) > remainingQty) {
            return res.status(400).json({ success: false, message: `Qty alokasi (${allocated_qty} PCS) melebihi sisa kebutuhan PO (${remainingQty} PCS).` });
        }

        let batchId;
        const [batchRows] = await connection.query(`SELECT batch_id, status FROM sipuro_db.batches WHERE batch_code = ?`, [batch_code]);

        if (batchRows.length > 0) {
            if (batchRows[0].status !== 'Open') return res.status(400).json({ success: false, message: 'Batch sudah Close atau Canceled.' });
            batchId = batchRows[0].batch_id;
            await connection.query(`UPDATE sipuro_db.batches SET target_qty = target_qty + ? WHERE batch_id = ?`, [allocated_qty, batchId]);
        } else {
            const [newBatch] = await connection.query(
                `INSERT INTO sipuro_db.batches (batch_code, id_product, production_date, expired_date, target_qty, output_qty, status, created_by) VALUES (?, ?, ?, ?, ?, 0, 'Open', ?)`,
                [batch_code, id_product, production_date, expired_date || null, allocated_qty, created_by]
            );
            batchId = newBatch.insertId;
        }

        await connection.query(
            `INSERT INTO sipuro_db.po_batch_allocations (po_detail_id, batch_id, allocated_qty, status, created_by) VALUES (?, ?, ?, 'Active', ?)`,
            [po_detail_id, batchId, allocated_qty, created_by]
        );

        await refreshPOStatus(connection, po_header_id);
        await connection.commit();

        res.json({ success: true, message: 'Alokasi Batch berhasil disimpan!' });
    } catch (error) {
        await connection.rollback();
        console.error('Error allocating batch:', error);
        res.status(500).json({ success: false, message: 'Gagal mengalokasikan batch', error: error.message });
    } finally {
        connection.release();
    }
};

exports.uploadProduction = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File Excel wajib diunggah.' });

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        const batchOutputMap = {};
        sheetData.forEach((row, idx) => {
            if (idx > 4 && row[1]) {
                const batchCode = String(row[1]).trim();
                const qtyCar = parseFloat(row[12] || row[13]) || 0;
                if (batchCode && qtyCar > 0) {
                    batchOutputMap[batchCode] = (batchOutputMap[batchCode] || 0) + qtyCar;
                }
            }
        });

        await connection.beginTransaction();
        const updatedBatches = [];

        for (const [batchCode, actualOutput] of Object.entries(batchOutputMap)) {
            const [batches] = await connection.query(`SELECT batch_id, target_qty FROM sipuro_db.batches WHERE batch_code = ? AND status = 'Open'`, [batchCode]);

            if (batches.length > 0) {
                const { batch_id, target_qty } = batches[0];
                const achievementPercent = target_qty > 0 ? (actualOutput / target_qty) * 100 : 0;
                const isAutoClose = achievementPercent >= AUTO_CLOSE_THRESHOLD_PERCENT;
                const newBatchStatus = isAutoClose ? 'Close' : 'Open';

                await connection.query(`UPDATE sipuro_db.batches SET output_qty = ?, status = ? WHERE batch_id = ?`, [actualOutput, newBatchStatus, batch_id]);

                const [allocations] = await connection.query(
                    `SELECT pba.allocation_id, pba.po_detail_id, pba.allocated_qty, pd.po_header_id
                     FROM sipuro_db.po_batch_allocations pba
                     JOIN sipuro_db.po_details pd ON pba.po_detail_id = pd.po_detail_id
                     WHERE pba.batch_id = ? AND pba.status = 'Active'`,
                    [batch_id]
                );

                const ratio = target_qty > 0 ? actualOutput / target_qty : 0;
                for (const alloc of allocations) {
                    const fulfilledForThisPO = Math.round(alloc.allocated_qty * ratio);
                    await connection.query(`UPDATE sipuro_db.po_details SET fulfilled_qty = fulfilled_qty + ? WHERE po_detail_id = ?`, [fulfilledForThisPO, alloc.po_detail_id]);
                    await refreshPOStatus(connection, alloc.po_header_id);
                }

                updatedBatches.push({
                    batch_code: batchCode,
                    output_qty: actualOutput,
                    target_qty,
                    achievement: `${achievementPercent.toFixed(1)}%`,
                    status: newBatchStatus
                });
            }
        }

        await connection.commit();
        res.json({ success: true, message: 'Upload dan Pemrosesan Excel Hasil Produksi Berhasil!', processed_batches: updatedBatches });
    } catch (error) {
        await connection.rollback();
        console.error('Error processing production upload:', error);
        res.status(500).json({ success: false, message: 'Gagal memproses file Excel', error: error.message });
    } finally {
        connection.release();
    }
};
