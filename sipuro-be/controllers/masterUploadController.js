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

// Helper aman konversi format tanggal
function safeFormatDate(rawDate) {
    if (!rawDate || String(rawDate).trim() === '' || String(rawDate) === 'None') return null;
    try {
        const parsed = new Date(rawDate);
        if (isNaN(parsed.getTime())) return null;
        return parsed.toISOString().split('T')[0];
    } catch {
        return null;
    }
}

/**
 * Preview Upload Master Produk (Superadmin)
 */
exports.previewProducts = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File Excel wajib diunggah.' });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        const headerIdx = findHeaderRowIndex(rawRows, ['DESCRIPTION']);
        if (headerIdx === -1) {
            return res.status(400).json({ success: false, message: 'Format kolom template Excel Produk tidak sesuai.' });
        }

        const headers = rawRows[headerIdx].map(h => String(h || '').trim());
        const dataRows = rawRows.slice(headerIdx + 1);

        const [existingProducts] = await db.query('SELECT product_code, product_name, base_uom, pcs_per_ctn, ctn_per_plt FROM sipuro_db.products');
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
            const pcsPerCtn = Number(rowObj['PAC / CAR']) || 0;
            const ctnPerPlt = Number(rowObj['CAR / PLT']) || 0;

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
                    changes: []
                });
            } else {
                const changes = [];
                if (existing.product_name !== productName) changes.push({ field: 'Nama Produk', oldVal: existing.product_name, newVal: productName });
                if (existing.base_uom !== uom) changes.push({ field: 'UOM', oldVal: existing.base_uom, newVal: uom });
                if (Number(existing.pcs_per_ctn) !== pcsPerCtn) changes.push({ field: 'Pcs/Ctn', oldVal: existing.pcs_per_ctn, newVal: pcsPerCtn });
                if (Number(existing.ctn_per_plt) !== ctnPerPlt) changes.push({ field: 'Ctn/Plt', oldVal: existing.ctn_per_plt, newVal: ctnPerPlt });

                if (changes.length > 0) {
                    updatedCount++;
                    previewList.push({
                        status: 'UPDATED',
                        product_code: oracleId,
                        product_name: productName,
                        base_uom: uom,
                        pcs_per_ctn: pcsPerCtn,
                        ctn_per_plt: ctnPerPlt,
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
                        changes: []
                    });
                }
            }
        }

        res.json({
            success: true,
            summary: { total: previewList.length, newCount, updatedCount, unchangedCount },
            data: previewList
        });
    } catch (error) {
        console.error('Error preview products:', error);
        res.status(500).json({ success: false, message: 'Gagal memproses file Excel Produk.', error: error.message });
    }
};

/**
 * Commit Upload Master Produk (Superadmin)
 */
exports.commitProducts = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const items = req.body.items || [];
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Tidak ada data produk yang dikirim untuk disimpan.' });
        }

        await connection.beginTransaction();

        let inserted = 0, updated = 0;

        for (const item of items) {
            if (item.status === 'NEW') {
                await connection.query(
                    `INSERT INTO sipuro_db.products (product_code, product_name, base_uom, pcs_per_ctn, ctn_per_plt, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
                    [item.product_code, item.product_name, item.base_uom, item.pcs_per_ctn, item.ctn_per_plt]
                );
                inserted++;
            } else if (item.status === 'UPDATED') {
                await connection.query(
                    `UPDATE sipuro_db.products SET product_name = ?, base_uom = ?, pcs_per_ctn = ?, ctn_per_plt = ? WHERE product_code = ?`,
                    [item.product_name, item.base_uom, item.pcs_per_ctn, item.ctn_per_plt, item.product_code]
                );
                updated++;
            }
        }

        await connection.commit();
        res.json({ success: true, message: `Berhasil menyimpan data produk. (${inserted} Ditambahkan, ${updated} Diperbarui)` });
    } catch (error) {
        await connection.rollback();
        console.error('Error commit products:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan data produk ke database.' });
    } finally {
        connection.release();
    }
};

/**
 * Preview Upload Harga Jual (Superadmin)
 */
exports.previewPrices = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File Excel wajib diunggah.' });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        const headerIdx = findHeaderRowIndex(rawRows, ['ORACLE', 'EXC. PPN']);
        if (headerIdx === -1) {
            return res.status(400).json({ success: false, message: 'Format kolom template Excel Harga Jual tidak sesuai.' });
        }

        const headers = rawRows[headerIdx].map(h => String(h || '').trim());
        const dataRows = rawRows.slice(headerIdx + 1);

        const [existingPrices] = await db.query(`
            SELECT sp.id_price, p.product_code, sp.price, sp.start_date, sp.end_date 
            FROM sipuro_db.product_selling_prices sp
            JOIN sipuro_db.products p ON sp.id_product = p.id_product
        `);

        const priceMap = new Map();
        existingPrices.forEach(p => {
            const dateStr = safeFormatDate(p.start_date) || '';
            priceMap.set(`${p.product_code}_${dateStr}`, p);
        });

        const previewList = [];
        let newCount = 0, updatedCount = 0, unchangedCount = 0;

        for (const row of dataRows) {
            const rowObj = {};
            headers.forEach((h, idx) => { rowObj[h] = row[idx]; });

            const oracleId = String(rowObj['ORACLE'] || rowObj['ID ORACLE'] || '').trim();
            if (!oracleId.toUpperCase().startsWith('FG')) continue;

            const priceExcPpn = Number(rowObj['EXC. PPN']) || 0;
            const startDate = safeFormatDate(rowObj['START DATE']);
            const endDate = safeFormatDate(rowObj['END DATE']);

            const key = `${oracleId}_${startDate}`;
            const existing = priceMap.get(key);

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
                if (Number(existing.price) !== priceExcPpn) changes.push({ field: 'Harga Exc PPN', oldVal: existing.price, newVal: priceExcPpn });
                const existingEndDate = safeFormatDate(existing.end_date);
                if (existingEndDate !== endDate) changes.push({ field: 'End Date', oldVal: existingEndDate || '-', newVal: endDate || '-' });

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
            summary: { total: previewList.length, newCount, updatedCount, unchangedCount },
            data: previewList
        });
    } catch (error) {
        console.error('Error preview prices:', error);
        res.status(500).json({ success: false, message: 'Gagal memproses file Excel Harga Jual.', error: error.message });
    }
};

/**
 * Commit Upload Harga Jual (Superadmin)
 */
exports.commitPrices = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const items = req.body.items || [];
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Tidak ada data harga yang dikirim untuk disimpan.' });
        }

        await connection.beginTransaction();

        let inserted = 0, updated = 0;

        for (const item of items) {
            const [prods] = await connection.query('SELECT id_product FROM sipuro_db.products WHERE product_code = ?', [item.product_code]);
            if (prods.length === 0) continue;

            const idProduct = prods[0].id_product;

            if (item.status === 'NEW') {
                await connection.query(
                    `INSERT INTO sipuro_db.product_selling_prices (id_product, price, start_date, end_date) VALUES (?, ?, ?, ?)`,
                    [idProduct, item.price, item.start_date, item.end_date]
                );
                inserted++;
            } else if (item.status === 'UPDATED') {
                await connection.query(
                    `UPDATE sipuro_db.product_selling_prices SET price = ?, end_date = ? WHERE id_product = ? AND start_date = ?`,
                    [item.price, item.end_date, idProduct, item.start_date]
                );
                updated++;
            }
        }

        await connection.commit();
        res.json({ success: true, message: `Berhasil menyimpan data harga jual. (${inserted} Ditambahkan, ${updated} Diperbarui)` });
    } catch (error) {
        await connection.rollback();
        console.error('Error commit prices:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan harga jual ke database.' });
    } finally {
        connection.release();
    }
};
