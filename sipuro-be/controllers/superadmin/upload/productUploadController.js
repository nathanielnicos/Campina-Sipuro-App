const xlsx = require('xlsx');
const { sipuroDb: db } = require('../../../config/db');
const { findHeaderRowIndex, parseToFixed } = require('../../../helpers/superadminHelper');

/**
 * Preview Upload Master Produk (Superadmin)
 */
exports.previewProducts = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Excel file is required.' });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        const headerIdx = findHeaderRowIndex(rawRows, ['DESCRIPTION']);
        if (headerIdx === -1) {
            return res.status(400).json({ success: false, message: 'Invalid Product Excel template column format.' });
        }

        const headers = rawRows[headerIdx].map(h => String(h || '').trim());
        const dataRows = rawRows.slice(headerIdx + 1);

        const [existingProducts] = await db.query('SELECT product_code, product_name, base_uom, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs FROM sipuro_db.products');
        const dbProductMap = new Map();
        existingProducts.forEach(p => dbProductMap.set(p.product_code, p));

        const previewList = [];
        let newCount = 0, updatedCount = 0, unchangedCount = 0;

        for (const row of dataRows) {
            const rowObj = {};
            headers.forEach((h, idx) => { rowObj[h] = row[idx]; });

            const oracleId = String(rowObj['ID ORACLE'] || rowObj['ORACLE'] || '').trim();
            if (!oracleId.toUpperCase().startsWith('FG')) continue;

            let uom = String(rowObj['UOM'] || 'PCS').trim().toUpperCase();
            if (uom === 'PAC') uom = 'PCS';

            const productName = String(rowObj['DESCRIPTION'] || '').trim();
            const pcsPerCtn = parseToFixed(rowObj['PAC / CAR'], 0) || 0;
            const ctnPerPlt = parseToFixed(rowObj['CAR / PLT'], 0) || 0;
            const mlPerPcs = parseToFixed(rowObj['VOL (ML) / PAC'], 6);
            const kgPerPcs = parseToFixed(rowObj['WEIGHT (KG) / PAC'], 6);

            const existing = dbProductMap.get(oracleId);

            if (!existing) {
                newCount++;
                previewList.push({
                    status: 'NEW',
                    product_code: oracleId,
                    product_name: productName,
                    base_uom: uom,
                    pcs_per_ctn: pcsPerCtn,
                    ctn_per_plt: ctnPerPlt,
                    ml_per_pcs: mlPerPcs,
                    kg_per_pcs: kgPerPcs,
                    changes: []
                });
            } else {
                const changes = [];

                if (existing.product_name !== productName) {
                    changes.push({ field: 'Product Name', oldVal: existing.product_name, newVal: productName });
                }
                if (existing.base_uom !== uom) {
                    changes.push({ field: 'UOM', oldVal: existing.base_uom, newVal: uom });
                }
                if (parseToFixed(existing.pcs_per_ctn, 0) !== pcsPerCtn) {
                    changes.push({ field: 'PCS / CTN', oldVal: existing.pcs_per_ctn, newVal: pcsPerCtn });
                }
                if (parseToFixed(existing.ctn_per_plt, 0) !== ctnPerPlt) {
                    changes.push({ field: 'CTN / PLT', oldVal: existing.ctn_per_plt, newVal: ctnPerPlt });
                }
                if (parseToFixed(existing.ml_per_pcs, 6) !== mlPerPcs) {
                    changes.push({ field: 'ML / PCS', oldVal: existing.ml_per_pcs ?? '-', newVal: mlPerPcs ?? '-' });
                }
                if (parseToFixed(existing.kg_per_pcs, 6) !== kgPerPcs) {
                    changes.push({ field: 'KG / PCS', oldVal: existing.kg_per_pcs ?? '-', newVal: kgPerPcs ?? '-' });
                }

                if (changes.length > 0) {
                    updatedCount++;
                    previewList.push({
                        status: 'UPDATED',
                        product_code: oracleId,
                        product_name: productName,
                        base_uom: uom,
                        pcs_per_ctn: pcsPerCtn,
                        ctn_per_plt: ctnPerPlt,
                        ml_per_pcs: mlPerPcs,
                        kg_per_pcs: kgPerPcs,
                        changes
                    });
                } else {
                    unchangedCount++;
                    previewList.push({
                        status: 'UNCHANGED',
                        product_code: oracleId,
                        product_name: productName,
                        base_uom: uom,
                        pcs_per_ctn: pcsPerCtn,
                        ctn_per_plt: ctnPerPlt,
                        ml_per_pcs: mlPerPcs,
                        kg_per_pcs: kgPerPcs,
                        changes: []
                    });
                }
            }
        }

        res.json({
            success: true,
            summary: { total: previewList.length, newCount, updatedCount, unchangedCount, notFoundCount: 0 },
            data: previewList
        });
    } catch (error) {
        console.error('Error preview products:', error);
        res.status(500).json({ success: false, message: 'Failed to process Product Excel file.', error: error.message });
    }
};

/**
 * Commit Upload Master Produk (Superadmin)
 */
exports.commitProducts = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const items = req.body.items || [];
        const createdBy = req.body.createdBy || 'SYSTEM';
        const itemsToProcess = items.filter(item => item.status === 'NEW' || item.status === 'UPDATED');

        if (itemsToProcess.length === 0) {
            return res.json({ success: true, message: 'No product data changes to save.' });
        }

        await connection.beginTransaction();

        let inserted = 0, updated = 0;

        for (const item of itemsToProcess) {
            if (item.status === 'NEW') {
                await connection.query(
                    `INSERT INTO sipuro_db.products (product_code, product_name, base_uom, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs, created_by, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                    [item.product_code, item.product_name, item.base_uom, item.pcs_per_ctn, item.ctn_per_plt, item.ml_per_pcs, item.kg_per_pcs, createdBy]
                );
                inserted++;
            } else if (item.status === 'UPDATED') {
                await connection.query(
                    `UPDATE sipuro_db.products 
                     SET product_name = ?, base_uom = ?, pcs_per_ctn = ?, ctn_per_plt = ?, ml_per_pcs = ?, kg_per_pcs = ?, created_by = ? 
                     WHERE product_code = ?`,
                    [item.product_name, item.base_uom, item.pcs_per_ctn, item.ctn_per_plt, item.ml_per_pcs, item.kg_per_pcs, createdBy, item.product_code]
                );
                updated++;
            }
        }

        await connection.commit();
        res.json({ success: true, message: `Successfully saved product data. (${inserted} Added, ${updated} Updated)` });
    } catch (error) {
        await connection.rollback();
        console.error('Error commit products:', error);
        res.status(500).json({ success: false, message: 'Failed to save product data to the database.', error: error.message });
    } finally {
        connection.release();
    }
};
