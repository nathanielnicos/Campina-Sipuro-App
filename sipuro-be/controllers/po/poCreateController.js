const { sipuroDb } = require('../../config/db');
const { createNotification } = require('../../helpers/notificationHelper');
const { logPOHeader, logPODetails } = require('../../helpers/poLogHelper');
const { getWibDateTimeString } = require('../../helpers/dateHelper');
const { generateNextPoNumber } = require('../../helpers/poHelper');
const { priceItems } = require('../../helpers/poPricing');
const { safeError } = require('../../helpers/safeError');

// Status awal yang boleh dikirim klien saat membuat PO.
const ALLOWED_CREATE_STATUSES = ['Draft', 'Waiting for Confirmation'];

/**
 * CREATE PO
 */
exports.createPO = async (req, res) => {
    const connection = await sipuroDb.getConnection();
    try {
        const { delivery_address, description, items, status } = req.body;
        // Identitas diambil dari token login, bukan dari body request.
        const customer_id = req.user.customerId;
        const created_by = req.user.id;

        if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Incomplete request data.' });
        }

        const targetStatus = (status === undefined || status === null || status === '') ? 'Waiting for Confirmation' : status;
        if (!ALLOWED_CREATE_STATUSES.includes(targetStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid PO status.' });
        }
        const safeDescription = description ? description.trim().slice(0, 50) : null;

        const [customerRows] = await sipuroDb.query(
            `SELECT company_name, customer_code FROM sipuro_db.customers WHERE customer_id = ?`,
            [customer_id]
        );
        const customerName = customerRows.length > 0 ? customerRows[0].company_name : 'Customer';
        const customerCode = (customerRows.length > 0 && customerRows[0].customer_code)
            ? customerRows[0].customer_code
            : 'CUST';

        const [profileRows] = await sipuroDb.query(`SELECT ppn_percent FROM sipuro_db.company_profile LIMIT 1`);
        const ppn_percent = profileRows.length > 0 && profileRows[0].ppn_percent !== null ? parseFloat(profileRows[0].ppn_percent) : 11;

        // Harga, total, dan PPN dihitung di server dari harga master yang berlaku hari ini.
        // unit_price / total_price dari klien tidak dipakai.
        const pricing = await priceItems({
            db: connection,
            items,
            poStatus: null,
            existingMap: null,
            ppnPercent: ppn_percent
        });
        const subtotal = pricing.subtotal;
        const total_amount = pricing.totalAmount;

        // Timestamp WIB presisi untuk created_at & updated_at
        const nowWib = getWibDateTimeString();

        await connection.beginTransaction();

        // Kunci baris po_settings sebagai antrean: pembuat PO lain menunggu sampai transaksi ini
        // selesai, sehingga dua PO yang dibuat bersamaan tidak mendapat nomor yang sama.
        // Kunci harus diambil sebelum membaca nomor terakhir.
        await connection.query(
            `SELECT setting_id FROM sipuro_db.po_settings ORDER BY setting_id DESC LIMIT 1 FOR UPDATE`
        );

        // Generate Nomor PO Terpusat melalui Helper (Ambil string poNumber)
        const { poNumber } = await generateNextPoNumber(connection, { customer_id, customerCode });

        // Insert Header
        const [headerResult] = await connection.query(
            `INSERT INTO sipuro_db.po_headers 
             (po_number, customer_id, subtotal, ppn_percent, total_amount, delivery_address, description, status, created_by, updated_by, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                poNumber,
                customer_id,
                subtotal,
                ppn_percent,
                total_amount,
                delivery_address || '',
                safeDescription,
                targetStatus,
                created_by || null,
                created_by || null,
                nowWib,
                nowWib
            ]
        );

        const poHeaderId = headerResult.insertId;
        const insertedDetails = [];

        for (const line of pricing.lines) {
            const [detailRes] = await connection.query(
                `INSERT INTO sipuro_db.po_details 
                 (po_header_id, id_product, qty, base_qty, uom, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs, base_price, total_price, status, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)`,
                [
                    poHeaderId,
                    line.id_product,
                    line.qty,
                    line.baseQty,
                    line.uom,
                    line.pcsPerCtn,
                    line.ctnPerPlt,
                    line.mlPerPcs,
                    line.kgPerPcs,
                    line.basePrice,
                    line.totalPrice,
                    line.notes
                ]
            );

            insertedDetails.push({
                po_detail_id: detailRes.insertId,
                id_product: line.id_product,
                old_qty: 0,
                new_qty: line.qty,
                old_base_qty: 0,
                new_base_qty: line.baseQty,
                old_total_price: 0,
                new_total_price: line.totalPrice,
                old_status: null,
                new_status: 'Active'
            });
        }

        // Audit Trail
        const poHeaderLogId = await logPOHeader(connection, {
            poHeaderId,
            actionType: 'CREATE',
            oldStatus: null,
            newStatus: targetStatus,
            actionBy: created_by || customer_id
        });

        await logPODetails(connection, poHeaderLogId, insertedDetails);

        await connection.commit();

        if (targetStatus !== 'Draft') {
            await createNotification({
                title: 'New PO Received',
                message: `${poNumber} has been created by ${customerName}.`,
                recipientType: 'EMPLOYEE',
                recipientDepartment: 'PPIC',
                senderType: 'CUSTOMER',
                senderId: customer_id,
                link: '/po-list?search=' + encodeURIComponent(poNumber)
            });
        }

        res.json({ success: true, message: 'Purchase Order created successfully!', data: { po_header_id: poHeaderId, po_number: poNumber } });
    } catch (error) {
        await connection.rollback();
        if (error && error.isValidation) {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error('Error creating PO:', error);
        res.status(500).json({ success: false, message: 'Failed to create Purchase Order.', error: safeError(error) });
    } finally {
        connection.release();
    }
};
