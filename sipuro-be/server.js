const express = require('express');
const cors = require('cors');
const { sipuroDb, campinaDb } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Test route untuk memastikan server berjalan
app.get('/', (req, res) => {
    res.send('Server Backend SIPURO Siap!');
});

// Endpoint untuk Login Multi-Role (Customer & Employee)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, role_type } = req.body;

        if (!username || !password || !role_type) {
            return res.status(400).json({
                success: false,
                message: 'Username/Code, Password, dan Role Type wajib diisi.'
            });
        }

        if (role_type === 'CUSTOMER') {
            // Check login customer di sipuro_db.customers
            const query = `
                SELECT customer_id, customer_code, company_name, email 
                FROM sipuro_db.customers 
                WHERE customer_code = ? AND password = ? AND is_active = 1
            `;
            const [rows] = await sipuroDb.query(query, [username, password]);

            if (rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Kode Customer atau Password salah, atau akun tidak aktif.'
                });
            }

            const user = rows[0];
            return res.json({
                success: true,
                message: 'Login Customer berhasil',
                data: {
                    id: user.customer_id,
                    code: user.customer_code,
                    name: user.company_name,
                    role: 'CUSTOMER'
                }
            });
        } else if (role_type === 'EMPLOYEE') {
            // Check login karyawan di campina_db.employees
            const query = `
                SELECT employee_id, full_name, department, role 
                FROM campina_db.employees 
                WHERE employee_id = ? AND password = ? AND is_suspended = 0
            `;
            const [rows] = await campinaDb.query(query, [username, password]);

            if (rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Employee ID atau Password salah, atau akun Anda tidak aktif.'
                });
            }

            const emp = rows[0];
            return res.json({
                success: true,
                message: 'Login Employee berhasil',
                data: {
                    id: emp.employee_id,
                    code: emp.employee_id,
                    name: emp.full_name,
                    department: emp.department,
                    role: emp.department // Role akan otomatis mengikuti departemennya (misal: 'PPIC')
                }
            });

        } else {
            return res.status(400).json({
                success: false,
                message: 'Role type tidak valid.'
            });
        }

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan pada server saat login.',
            error: error.message
        });
    }
});

// Endpoint untuk mengambil daftar PO milik customer
app.get('/api/po', async (req, res) => {
    try {
        const { customer_id } = req.query;

        let whereClause = '';
        const queryParams = [];

        if (customer_id && customer_id !== 'null' && customer_id !== 'undefined') {
            whereClause = 'WHERE h.customer_id = ?';
            queryParams.push(customer_id);
        }

        const query = `
            SELECT 
                h.po_header_id,
                h.po_number,
                h.created_at,
                h.requested_delivery_date,
                h.total_amount,
                h.status,
                c.company_name,
                COUNT(d.po_detail_id) AS total_items
            FROM sipuro_db.po_headers h
            LEFT JOIN sipuro_db.customers c 
                ON h.customer_id = c.customer_id
            LEFT JOIN sipuro_db.po_details d 
                ON h.po_header_id = d.po_header_id AND d.deleted_at IS NULL
            ${whereClause}
            GROUP BY h.po_header_id
            ORDER BY h.created_at DESC
        `;

        const [rows] = await sipuroDb.query(query, queryParams);

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching PO list:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data Purchase Order',
            error: error.message
        });
    }
});

// Endpoint untuk mengambil daftar produk aktif beserta harga jual berlaku
app.get('/api/products', async (req, res) => {
    try {
        const query = `
      SELECT 
        p.id_product,
        p.product_code,
        p.product_name,
        p.base_uom,
        p.pcs_per_ctn,
        p.ctn_per_plt,
        sp.price AS base_price
      FROM campina_db.products p
      JOIN campina_db.product_selling_prices sp 
        ON p.id_product = sp.id_product
      WHERE p.is_active = 1
        AND sp.start_date <= CURDATE()
        AND (sp.end_date IS NULL OR sp.end_date >= CURDATE())
      ORDER BY p.product_name ASC
    `;

        const [rows] = await campinaDb.query(query);

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data produk',
            error: error.message
        });
    }
});

// Endpoint untuk mengambil konfigurasi company profile (termasuk ppn_percent)
app.get('/api/company-profile', async (req, res) => {
    try {
        const query = `SELECT ppn_percent FROM campina_db.company_profile LIMIT 1`;
        const [rows] = await campinaDb.query(query);

        // Jika data tidak ada di DB, lempar error (tanpa fallback/default)
        if (rows.length === 0 || rows[0].ppn_percent === null) {
            return res.status(404).json({
                success: false,
                message: 'Data PPN tidak ditemukan di company_profile.'
            });
        }

        res.json({
            success: true,
            data: {
                ppn_percent: parseFloat(rows[0].ppn_percent)
            }
        });
    } catch (error) {
        console.error('Error fetching company profile:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data company profile',
            error: error.message
        });
    }
});

// Endpoint untuk menyimpan PO baru (Header & Details)
app.post('/api/po', async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { customer_id, requested_delivery_date, delivery_address, description, items } = req.body;

        if (!customer_id || !requested_delivery_date || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Data tidak lengkap. Customer ID, tanggal pengiriman, dan item produk wajib diisi.'
            });
        }

        // 1. Ambil ppn_percent dari company_profile
        const [profileRows] = await campinaDb.query(`SELECT ppn_percent FROM campina_db.company_profile LIMIT 1`);
        const ppn_percent = profileRows.length > 0 && profileRows[0].ppn_percent !== null
            ? parseFloat(profileRows[0].ppn_percent)
            : 11;

        // 2. Hitung subtotal dan total_amount
        let subtotal = 0;
        items.forEach(item => {
            const itemPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            subtotal += (itemPrice * qty);
        });

        const total_amount = subtotal + (subtotal * (ppn_percent / 100));

        // 3. Generate Nomor PO Otomatis (Contoh: PO-YYYYMMDD-XXX)
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const randomNum = Math.floor(100 + Math.random() * 900);
        const poNumber = `PO-${dateStr}-${randomNum}`;

        // Mulai Database Transaction
        await connection.beginTransaction();

        // 4. Insert ke po_headers
        const insertHeaderQuery = `
          INSERT INTO sipuro_db.po_headers 
            (po_number, customer_id, subtotal, ppn_percent, total_amount, requested_delivery_date, delivery_address, description, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Waiting for Confirmation')
        `;

        const [headerResult] = await connection.query(insertHeaderQuery, [
            poNumber,
            customer_id,
            subtotal,
            ppn_percent,
            total_amount,
            requested_delivery_date,
            delivery_address || '',
            description || null
        ]);

        const poHeaderId = headerResult.insertId;

        // 5. Insert ke po_details
        const insertDetailQuery = `
          INSERT INTO sipuro_db.po_details 
            (po_header_id, id_product, qty, uom, base_price, total_price, notes)
          VALUES ?
        `;

        const detailValues = items.map(item => {
            const unitPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            const totalPrice = item.total_price !== undefined ? parseFloat(item.total_price) : (unitPrice * qty);
            const selectedUom = item.selected_uom || item.uom || item.base_uom || 'PCS';

            return [
                poHeaderId,
                item.id_product,
                qty,
                selectedUom,
                unitPrice,
                totalPrice,
                item.notes || null
            ];
        });

        await connection.query(insertDetailQuery, [detailValues]);

        // Commit Transaction jika semua query berhasil
        await connection.commit();

        res.json({
            success: true,
            message: 'Purchase Order berhasil dibuat!',
            data: {
                po_header_id: poHeaderId,
                po_number: poNumber
            }
        });

    } catch (error) {
        // Rollback jika terjadi kesalahan
        await connection.rollback();
        console.error('Error creating PO:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal membuat Purchase Order',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// Endpoint untuk mengambil detail data customer berdasarkan ID
app.get('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
      SELECT 
        customer_id,
        company_name,
        delivery_address
      FROM sipuro_db.customers
      WHERE customer_id = ?
    `;

        const [rows] = await sipuroDb.query(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Customer tidak ditemukan'
            });
        }

        res.json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Error fetching customer detail:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data customer',
            error: error.message
        });
    }
});

// Endpoint GET Detail PO
app.get('/api/po/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Ambil data header PO
        const headerQuery = `
            SELECT 
                h.*,
                c.company_name
            FROM sipuro_db.po_headers h
            LEFT JOIN sipuro_db.customers c ON h.customer_id = c.customer_id
            WHERE h.po_header_id = ?
        `;
        const [headerRows] = await sipuroDb.query(headerQuery, [id]);

        if (headerRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Data PO tidak ditemukan.'
            });
        }

        // Ambil data detail item PO
        const detailQuery = `
            SELECT 
                d.*,
                p.product_code,
                p.product_name,
                p.base_uom,
                p.pcs_per_ctn,
                p.ctn_per_plt
            FROM sipuro_db.po_details d
            JOIN campina_db.products p ON d.id_product = p.id_product
            WHERE d.po_header_id = ? AND d.deleted_at IS NULL
        `;
        const [detailRows] = await sipuroDb.query(detailQuery, [id]);

        res.json({
            success: true,
            data: {
                header: headerRows[0],
                items: detailRows
            }
        });
    } catch (error) {
        console.error('Error fetching PO detail:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil detail PO',
            error: error.message
        });
    }
});

// Endpoint PUT Update/Edit PO (Best Practice Hybrid)
app.put('/api/po/:id', async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { id } = req.params;
        const { requested_delivery_date, delivery_address, description, items } = req.body;

        // Cek status PO
        const [checkRows] = await connection.query(
            `SELECT status FROM sipuro_db.po_headers WHERE po_header_id = ?`,
            [id]
        );

        if (checkRows.length === 0) {
            return res.status(404).json({ success: false, message: 'PO tidak ditemukan.' });
        }

        if (checkRows[0].status !== 'Waiting for Confirmation') {
            return res.status(400).json({
                success: false,
                message: 'PO tidak dapat diubah karena status bukan "Waiting for Confirmation".'
            });
        }

        // Ambil tarif PPN dari company profile
        const [profileRows] = await campinaDb.query(`SELECT ppn_percent FROM campina_db.company_profile LIMIT 1`);
        const ppn_percent = profileRows.length > 0 && profileRows[0].ppn_percent !== null
            ? parseFloat(profileRows[0].ppn_percent)
            : 11;

        // Hitung subtotal & total_amount
        let subtotal = 0;
        items.forEach(item => {
            const itemPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            subtotal += (itemPrice * qty);
        });

        const total_amount = subtotal + (subtotal * (ppn_percent / 100));

        await connection.beginTransaction();

        // 1. Update Header
        const updateHeaderQuery = `
            UPDATE sipuro_db.po_headers 
            SET subtotal = ?, ppn_percent = ?, total_amount = ?, requested_delivery_date = ?, delivery_address = ?, description = ?
            WHERE po_header_id = ?
        `;
        await connection.query(updateHeaderQuery, [
            subtotal,
            ppn_percent,
            total_amount,
            requested_delivery_date,
            delivery_address || '',
            description || null,
            id
        ]);

        // 2. Ambil semua po_detail_id aktif yang tersimpan di DB saat ini
        const [existingDetails] = await connection.query(
            `SELECT po_detail_id FROM sipuro_db.po_details WHERE po_header_id = ? AND deleted_at IS NULL`,
            [id]
        );

        const existingIds = existingDetails.map(row => row.po_detail_id);
        const payloadDetailIds = items.map(item => item.po_detail_id).filter(Boolean);

        // 3. Cari ID item yang dihapus dari UI -> tandai soft delete (deleted_at = NOW())
        const idsToDelete = existingIds.filter(detailId => !payloadDetailIds.includes(detailId));
        if (idsToDelete.length > 0) {
            await connection.query(
                `UPDATE sipuro_db.po_details SET deleted_at = NOW() WHERE po_detail_id IN (?)`,
                [idsToDelete]
            );
        }

        // 4. Loop payload item untuk UPDATE atau INSERT
        for (const item of items) {
            const unitPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : item.base_price) || 0;
            const qty = parseInt(item.qty) || 0;
            const totalPrice = item.total_price !== undefined ? parseFloat(item.total_price) : (unitPrice * qty);
            const selectedUom = item.selected_uom || item.uom || item.base_uom || 'PCS';

            if (item.po_detail_id && existingIds.includes(item.po_detail_id)) {
                // UPDATE baris eksis
                const updateDetailQuery = `
                    UPDATE sipuro_db.po_details 
                    SET id_product = ?, qty = ?, uom = ?, base_price = ?, total_price = ?, notes = ?
                    WHERE po_detail_id = ?
                `;
                await connection.query(updateDetailQuery, [
                    item.id_product,
                    qty,
                    selectedUom,
                    unitPrice,
                    totalPrice,
                    item.notes || null,
                    item.po_detail_id
                ]);
            } else {
                // INSERT baris baru (SKU tambahan baru)
                const insertDetailQuery = `
                    INSERT INTO sipuro_db.po_details 
                        (po_header_id, id_product, qty, uom, base_price, total_price, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                await connection.query(insertDetailQuery, [
                    id,
                    item.id_product,
                    qty,
                    selectedUom,
                    unitPrice,
                    totalPrice,
                    item.notes || null
                ]);
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Purchase Order berhasil diperbarui!'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating PO:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui Purchase Order',
            error: error.message
        });
    } finally {
        connection.release();
    }
});

// Endpoint PATCH Cancel PO
app.patch('/api/po/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;

        // Cek status PO
        const [checkRows] = await sipuroDb.query(
            `SELECT status FROM sipuro_db.po_headers WHERE po_header_id = ?`,
            [id]
        );

        if (checkRows.length === 0) {
            return res.status(404).json({ success: false, message: 'PO tidak ditemukan.' });
        }

        if (checkRows[0].status !== 'Waiting for Confirmation') {
            return res.status(400).json({
                success: false,
                message: 'PO tidak dapat dibatalkan karena status bukan "Waiting for Confirmation".'
            });
        }

        // Update status PO menjadi Canceled
        await sipuroDb.query(
            `UPDATE sipuro_db.po_headers SET status = 'Canceled' WHERE po_header_id = ?`,
            [id]
        );

        res.json({
            success: true,
            message: 'Purchase Order berhasil dibatalkan.'
        });
    } catch (error) {
        console.error('Error cancelling PO:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal membatalkan Purchase Order',
            error: error.message
        });
    }
});

// Endpoint untuk Update Status PO (Approve / Reject oleh PPIC)
app.put('/api/po/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, updated_by } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status wajib diisi.'
            });
        }

        const query = `
            UPDATE sipuro_db.po_headers 
            SET status = ?, 
                rejection_reason = ?, 
                confirmed_by = ?, 
                confirmed_at = NOW() 
            WHERE po_header_id = ?
        `;

        const [result] = await sipuroDb.query(query, [status, notes || null, updated_by || null, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Data PO tidak ditemukan.'
            });
        }

        res.json({
            success: true,
            message: `Status PO berhasil diperbarui menjadi ${status}.`
        });

    } catch (error) {
        console.error('Error updating PO status:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui status PO.',
            error: error.message
        });
    }
});

// ==================================================
// MODUL PPIC: ALOKASI BATCH & UPLOAD EXCEL PRODUKSI
// ==================================================
const multer = require('multer');
const XLSX = require('xlsx');

// Konfigurasi Multer untuk Simpan File Excel Sementara di Memory Buffer
const upload = multer({ storage: multer.memoryStorage() });

// Constant Threshold Auto-Close Batch (90%)
const AUTO_CLOSE_THRESHOLD_PERCENT = 90;

// Helper: Fungsi Re-evaluasi Status PO secara Otomatis
async function refreshPOStatus(connection, poHeaderId) {
    // 1. Ambil seluruh item detail PO aktif
    const [details] = await connection.query(
        `SELECT po_detail_id, base_qty FROM sipuro_db.po_details WHERE po_header_id = ? AND deleted_at IS NULL`,
        [poHeaderId]
    );

    if (details.length === 0) return;

    let isFullyAllocated = true;
    let isAllAllocationsClosed = true;

    for (const item of details) {
        // Total alokasi aktif untuk detail ini
        const [allocRows] = await connection.query(
            `SELECT SUM(allocated_qty) AS total_allocated 
             FROM sipuro_db.po_batch_allocations 
             WHERE po_detail_id = ? AND status = 'Active'`,
            [item.po_detail_id]
        );
        const totalAllocated = allocRows[0].total_allocated || 0;

        if (totalAllocated < item.base_qty) {
            isFullyAllocated = false;
        }

        // Cek status batch dari alokasi yang terhubung
        const [batchStatusRows] = await connection.query(
            `SELECT b.status 
             FROM sipuro_db.po_batch_allocations pba
             JOIN sipuro_db.batches b ON pba.batch_id = b.batch_id
             WHERE pba.po_detail_id = ? AND pba.status = 'Active'`,
            [item.po_detail_id]
        );

        if (batchStatusRows.length === 0 || batchStatusRows.some(b => b.status !== 'Close')) {
            isAllAllocationsClosed = false;
        }
    }

    // Tentukan Status Baru Header PO
    let newPOStatus = 'Waiting Batch Assignment';
    if (isFullyAllocated) {
        newPOStatus = isAllAllocationsClosed ? 'Completed' : 'On Process';
    }

    await connection.query(
        `UPDATE sipuro_db.po_headers SET status = ? WHERE po_header_id = ?`,
        [newPOStatus, poHeaderId]
    );
}

// 1. ENDPOINT: Tambah Alokasi Batch Baru ke Item PO
app.post('/api/ppic/allocations', async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { po_detail_id, batch_code, production_date, expired_date, allocated_qty, created_by } = req.body;

        if (!po_detail_id || !batch_code || !production_date || !allocated_qty || !created_by) {
            return res.status(400).json({
                success: false,
                message: 'Data alokasi tidak lengkap.'
            });
        }

        await connection.beginTransaction();

        // Ambil info PO Detail & Produk
        const [detailRows] = await connection.query(
            `SELECT d.po_header_id, d.id_product, d.base_qty, h.status AS po_status
             FROM sipuro_db.po_details d
             JOIN sipuro_db.po_headers h ON d.po_header_id = h.po_header_id
             WHERE d.po_detail_id = ? AND d.deleted_at IS NULL`,
            [po_detail_id]
        );

        if (detailRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Item PO Detail tidak ditemukan.' });
        }

        const { po_header_id, id_product, base_qty } = detailRows[0];

        // Validasi Sisa Base Qty PO Detail
        const [existingAlloc] = await connection.query(
            `SELECT SUM(allocated_qty) AS current_alloc 
             FROM sipuro_db.po_batch_allocations 
             WHERE po_detail_id = ? AND status = 'Active'`,
            [po_detail_id]
        );
        const currentAllocated = existingAlloc[0].current_alloc || 0;
        const remainingQty = base_qty - currentAllocated;

        if (parseInt(allocated_qty) > remainingQty) {
            return res.status(400).json({
                success: false,
                message: `Qty alokasi (${allocated_qty} PCS) melebihi sisa kebutuhan PO (${remainingQty} PCS).`
            });
        }

        // Cek atau buat record Batch di sipuro_db.batches
        let batchId;
        const [batchRows] = await connection.query(
            `SELECT batch_id, status FROM sipuro_db.batches WHERE batch_code = ?`,
            [batch_code]
        );

        if (batchRows.length > 0) {
            if (batchRows[0].status !== 'Open') {
                return res.status(400).json({ success: false, message: 'Batch sudah Close atau Canceled.' });
            }
            batchId = batchRows[0].batch_id;
            // Accumulate target_qty
            await connection.query(
                `UPDATE sipuro_db.batches SET target_qty = target_qty + ? WHERE batch_id = ?`,
                [allocated_qty, batchId]
            );
        } else {
            // Insert Batch Baru
            const [newBatch] = await connection.query(
                `INSERT INTO sipuro_db.batches 
                 (batch_code, id_product, production_date, expired_date, target_qty, output_qty, status, created_by)
                 VALUES (?, ?, ?, ?, ?, 0, 'Open', ?)`,
                [batch_code, id_product, production_date, expired_date || null, allocated_qty, created_by]
            );
            batchId = newBatch.insertId;
        }

        // Insert Record Alokasi
        await connection.query(
            `INSERT INTO sipuro_db.po_batch_allocations 
             (po_detail_id, batch_id, allocated_qty, status, created_by)
             VALUES (?, ?, ?, 'Active', ?)`,
            [po_detail_id, batchId, allocated_qty, created_by]
        );

        // Update Auto Status PO Header
        await refreshPOStatus(connection, po_header_id);

        await connection.commit();

        res.json({
            success: true,
            message: 'Alokasi Batch berhasil disimpan!'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error allocating batch:', error);
        res.status(500).json({ success: false, message: 'Gagal mengalokasikan batch', error: error.message });
    } finally {
        connection.release();
    }
});

// 2. ENDPOINT: Upload File Excel RORCMAN02 Hasil Produksi
app.post('/api/ppic/upload-production', upload.single('excel_file'), async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'File Excel wajib diunggah.' });
        }

        // Read Workbook dari Buffer
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

        // Map untuk menampung agregasi output per batch_code
        const batchOutputMap = {};

        // Parse baris Excel RORCMAN02 (Detail ada di Kolom B index 1 & Qty di Index 12)
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
            // Ambil batch 'Open' dari DB
            const [batches] = await connection.query(
                `SELECT batch_id, target_qty FROM sipuro_db.batches WHERE batch_code = ? AND status = 'Open'`,
                [batchCode]
            );

            if (batches.length > 0) {
                const { batch_id, target_qty } = batches[0];
                const achievementPercent = target_qty > 0 ? (actualOutput / target_qty) * 100 : 0;
                const isAutoClose = achievementPercent >= AUTO_CLOSE_THRESHOLD_PERCENT;
                const newBatchStatus = isAutoClose ? 'Close' : 'Open';

                // Update output_qty & status pada batch
                await connection.query(
                    `UPDATE sipuro_db.batches SET output_qty = ?, status = ? WHERE batch_id = ?`,
                    [actualOutput, newBatchStatus, batch_id]
                );

                // Ambil daftar alokasi PO aktif untuk batch ini
                const [allocations] = await connection.query(
                    `SELECT pba.allocation_id, pba.po_detail_id, pba.allocated_qty, pd.po_header_id
                     FROM sipuro_db.po_batch_allocations pba
                     JOIN sipuro_db.po_details pd ON pba.po_detail_id = pd.po_detail_id
                     WHERE pba.batch_id = ? AND pba.status = 'Active'`,
                    [batch_id]
                );

                // Distribusi Proporsional Qty Terpenuhi ke PO Detail
                const ratio = target_qty > 0 ? actualOutput / target_qty : 0;
                for (const alloc of allocations) {
                    const fulfilledForThisPO = Math.round(alloc.allocated_qty * ratio);

                    await connection.query(
                        `UPDATE sipuro_db.po_details 
                         SET fulfilled_qty = fulfilled_qty + ? 
                         WHERE po_detail_id = ?`,
                        [fulfilledForThisPO, alloc.po_detail_id]
                    );

                    // Re-evaluasi status PO Header
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

        res.json({
            success: true,
            message: 'Upload dan Pemrosesan Excel Hasil Produksi Berhasil!',
            processed_batches: updatedBatches
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error processing production upload:', error);
        res.status(500).json({ success: false, message: 'Gagal memproses file Excel', error: error.message });
    } finally {
        connection.release();
    }
});

// Jalankan server
app.listen(PORT, () => {
    console.log(`Server Express berjalan di port ${PORT}`);
});
