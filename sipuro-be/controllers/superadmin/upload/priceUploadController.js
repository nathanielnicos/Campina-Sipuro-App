const xlsx = require('xlsx');
const { sipuroDb: db } = require('../../../config/db');
const { findHeaderRowIndex, parseToFixed, safeFormatDate } = require('../../../helpers/superadminHelper');

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

        // 2. Ambil daftar harga yang sudah ada di tabel product_selling_prices (Gunakan DATE_FORMAT agar nilai tanggal murni string)
        const [existingPrices] = await db.query(`
            SELECT 
                sp.price_id, 
                p.product_code, 
                sp.price, 
                DATE_FORMAT(sp.start_date, '%Y-%m-%d') AS start_date, 
                DATE_FORMAT(sp.end_date, '%Y-%m-%d') AS end_date 
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
