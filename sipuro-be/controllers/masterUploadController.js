const xlsx = require('xlsx');
const { sipuroDb: db } = require('../config/db');

function findHeaderRowIndex(sheetData, requiredColumns) {
    for (let r = 0; r < sheetData.length; r++) {
        const rowUpper = sheetData[r].map(c => String(c || '').toUpperCase().trim());
        const matched = requiredColumns.every(col => rowUpper.includes(col.toUpperCase().trim()));
        if (matched) return r;
    }
    return -1;
}

// Helper aman konversi format tanggal ke format YYYY-MM-DD / null
function safeFormatDate(rawDate) {
    if (
        rawDate === null ||
        rawDate === undefined ||
        String(rawDate).trim() === '' ||
        String(rawDate) === 'None' ||
        String(rawDate).trim() === '-'
    ) {
        return null;
    }

    try {
        // Jika angka serial Excel
        if (typeof rawDate === 'number' || (!isNaN(Number(rawDate)) && !String(rawDate).includes('-') && !String(rawDate).includes('/'))) {
            const parsedDate = xlsx.SSF.parse_date_code(Number(rawDate));
            if (parsedDate) {
                const y = parsedDate.y;
                const m = String(parsedDate.m).padStart(2, '0');
                const d = String(parsedDate.d).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }

        // Jika String atau Date object
        const parsed = new Date(rawDate);
        if (isNaN(parsed.getTime())) return null;

        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    } catch {
        return null;
    }
}

function parseToFixed(val, precision = 6) {
    if (val === null || val === undefined || val === '' || isNaN(Number(val))) return null;
    return Number(Number(val).toFixed(precision));
}

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

/**
 * Preview Upload Harga Jual (Superadmin)
 */
exports.previewPrices = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Excel file is required.' });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        const headerIdx = findHeaderRowIndex(rawRows, ['ORACLE', 'EXC. PPN']);
        if (headerIdx === -1) {
            return res.status(400).json({ success: false, message: 'Invalid Selling Price Excel template column format.' });
        }

        const headers = rawRows[headerIdx].map(h => String(h || '').trim());
        const dataRows = rawRows.slice(headerIdx + 1);

        // ------------------------------------------------------------------
        // DEDUPLIKASI EXCEL: Ambil baris SKU dengan START DATE paling terkini
        // ------------------------------------------------------------------
        const excelUniqueMap = new Map();

        for (const row of dataRows) {
            const rowObj = {};
            headers.forEach((h, idx) => { rowObj[h] = row[idx]; });

            const oracleId = String(rowObj['ORACLE'] || rowObj['ID ORACLE'] || '').trim();
            if (!oracleId.toUpperCase().startsWith('FG')) continue;

            const currentDate = safeFormatDate(rowObj['START DATE']);

            if (!excelUniqueMap.has(oracleId)) {
                excelUniqueMap.set(oracleId, rowObj);
            } else {
                const existingRow = excelUniqueMap.get(oracleId);
                const existingDate = safeFormatDate(existingRow['START DATE']);

                // Pilih tanggal yang lebih baru (terkini)
                if (!existingDate || (currentDate && currentDate >= existingDate)) {
                    excelUniqueMap.set(oracleId, rowObj);
                }
            }
        }
        // ------------------------------------------------------------------

        // 1. Ambil daftar SELURUH produk terdaftar di tabel products
        const [registeredProducts] = await db.query('SELECT id_product, product_code FROM sipuro_db.products');
        const registeredProductCodes = new Set(registeredProducts.map(p => p.product_code));

        // 2. Ambil daftar harga yang sudah ada di tabel product_selling_prices
        const [existingPrices] = await db.query(`
            SELECT sp.price_id, p.product_code, sp.price, sp.start_date, sp.end_date 
            FROM sipuro_db.product_selling_prices sp
            JOIN sipuro_db.products p ON sp.id_product = p.id_product
        `);

        const priceMap = new Map();
        existingPrices.forEach(p => {
            priceMap.set(p.product_code, p);
        });

        const previewList = [];
        let newCount = 0, updatedCount = 0, unchangedCount = 0, notFoundCount = 0;

        // Iterasi data Excel yang sudah dibersihkan (unique SKU)
        for (const [oracleId, rowObj] of excelUniqueMap.entries()) {
            const priceExcPpn = parseToFixed(rowObj['EXC. PPN'], 0) || 0;
            const startDate = safeFormatDate(rowObj['START DATE']);
            const endDate = safeFormatDate(rowObj['END DATE']);

            // JIKA SKU TIDAK TERDAFTAR DI TABEL PRODUCTS -> NOT_FOUND
            if (!registeredProductCodes.has(oracleId)) {
                notFoundCount++;
                previewList.push({
                    status: 'NOT_FOUND',
                    product_code: oracleId,
                    description: rowObj['DESCRIPTION'],
                    price: priceExcPpn,
                    start_date: startDate,
                    end_date: endDate,
                    changes: []
                });
                continue;
            }

            const existing = priceMap.get(oracleId);

            if (!existing) {
                newCount++;
                previewList.push({
                    status: 'NEW',
                    product_code: oracleId,
                    description: rowObj['DESCRIPTION'],
                    price: priceExcPpn,
                    start_date: startDate,
                    end_date: endDate,
                    changes: []
                });
            } else {
                const changes = [];

                if (parseToFixed(existing.price, 0) !== priceExcPpn) {
                    changes.push({ field: 'Price Excl. VAT', oldVal: parseToFixed(existing.price, 0), newVal: priceExcPpn });
                }

                // Normalisasi tanggal DB dan Excel ke YYYY-MM-DD
                const existingStartDate = safeFormatDate(existing.start_date);
                const existingEndDate = safeFormatDate(existing.end_date);

                if (existingStartDate !== startDate) {
                    changes.push({ field: 'Start Date', oldVal: existingStartDate || '-', newVal: startDate || '-' });
                }

                if (existingEndDate !== endDate) {
                    changes.push({ field: 'End Date', oldVal: existingEndDate || '-', newVal: endDate || '-' });
                }

                if (changes.length > 0) {
                    updatedCount++;
                    previewList.push({
                        status: 'UPDATED',
                        product_code: oracleId,
                        description: rowObj['DESCRIPTION'],
                        price: priceExcPpn,
                        start_date: startDate,
                        end_date: endDate,
                        changes
                    });
                } else {
                    unchangedCount++;
                    previewList.push({
                        status: 'UNCHANGED',
                        product_code: oracleId,
                        description: rowObj['DESCRIPTION'],
                        price: priceExcPpn,
                        start_date: startDate,
                        end_date: endDate,
                        changes: []
                    });
                }
            }
        }

        res.json({
            success: true,
            summary: { total: previewList.length, newCount, updatedCount, unchangedCount, notFoundCount },
            data: previewList
        });
    } catch (error) {
        console.error('Error preview prices:', error);
        res.status(500).json({ success: false, message: 'Failed to process Selling Price Excel file.', error: error.message });
    }
};

/**
 * Commit Upload Harga Jual (Superadmin)
 */
exports.commitPrices = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const items = req.body.items || [];
        const createdBy = req.body.createdBy || 'SYSTEM';
        const itemsToProcess = items.filter(item => item.status === 'NEW' || item.status === 'UPDATED');

        if (itemsToProcess.length === 0) {
            return res.json({ success: true, message: 'No price data changes to save.' });
        }

        await connection.beginTransaction();

        const productCodes = [...new Set(itemsToProcess.map(i => i.product_code))].filter(Boolean);
        if (productCodes.length === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'No valid product codes found in request.' });
        }

        const [prods] = await connection.query(
            'SELECT id_product, product_code FROM sipuro_db.products WHERE product_code IN (?)',
            [productCodes]
        );
        const productMap = new Map(prods.map(p => [p.product_code, p.id_product]));

        let inserted = 0, updated = 0;

        for (const item of itemsToProcess) {
            const idProduct = productMap.get(item.product_code);
            if (!idProduct) continue;

            // Pastikan nilai tanggal berupa NULL jika tidak diisi
            const startDateVal = item.start_date ? item.start_date : null;
            const endDateVal = item.end_date ? item.end_date : null;

            if (item.status === 'NEW') {
                await connection.query(
                    `INSERT INTO sipuro_db.product_selling_prices (id_product, price, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?)`,
                    [idProduct, item.price, startDateVal, endDateVal, createdBy]
                );
                inserted++;
            } else if (item.status === 'UPDATED') {
                await connection.query(
                    `UPDATE sipuro_db.product_selling_prices SET price = ?, start_date = ?, end_date = ?, created_by = ? WHERE id_product = ?`,
                    [item.price, startDateVal, endDateVal, createdBy, idProduct]
                );
                updated++;
            }
        }

        await connection.commit();
        res.json({ success: true, message: `Successfully saved selling price data. (${inserted} Added, ${updated} Updated)` });
    } catch (error) {
        await connection.rollback();
        console.error('Error commit prices:', error);
        res.status(500).json({ success: false, message: 'Failed to save selling prices to the database.', error: error.message });
    } finally {
        connection.release();
    }
};
