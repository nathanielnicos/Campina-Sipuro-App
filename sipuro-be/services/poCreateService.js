'use strict';

/**
 * Satu-satunya tempat PO baru dibuat. Dipakai oleh:
 *  - createPO (customer membuat PO sendiri), dan
 *  - createDraftPO (PPIC menyarankan draft dari Production Schedule).
 * Urutan di sini sengaja tetap: harga dihitung dulu, lalu transaksi dimulai, baris po_settings
 * dikunci sebelum nomor PO dibaca (agar dua PO yang dibuat bersamaan tidak berebut nomor),
 * baru header, detail, dan log ditulis, lalu commit. Rollback dilakukan oleh pemanggil.
 */

const { getWibDateTimeString } = require('../helpers/dateHelper');
const { generateNextPoNumber } = require('../helpers/poHelper');
const { logPOHeader, logPODetails } = require('../helpers/poLogHelper');
const { priceItems } = require('../helpers/poPricing');

const DEFAULT_PPN_PERCENT = 11;

/** Data customer yang dibutuhkan untuk membuat PO (kosong bila tidak ada). */
const findCustomer = async (db, customerId) => {
    const [rows] = await db.query(
        `SELECT company_name, customer_code, delivery_address, is_active FROM sipuro_db.customers WHERE customer_id = ?`,
        [customerId]
    );
    return rows.length > 0 ? rows[0] : null;
};

/** Persen PPN perusahaan saat ini. */
const getCurrentPpnPercent = async (db) => {
    const [rows] = await db.query(`SELECT ppn_percent FROM sipuro_db.company_profile LIMIT 1`);
    return rows.length > 0 && rows[0].ppn_percent !== null ? parseFloat(rows[0].ppn_percent) : DEFAULT_PPN_PERCENT;
};

/**
 * @param {object} connection  koneksi dari pool (transaksi dimulai di sini)
 * @param {object} input
 * @param {number} input.customerId
 * @param {string} input.customerCode
 * @param {Array}  input.items            [{ id_product, qty }]
 * @param {number} input.ppnPercent
 * @param {string} input.status           'Draft' | 'Waiting for Confirmation'
 * @param {string} input.deliveryAddress
 * @param {string|null} input.description
 * @param {number|null} input.createdBy   customer_users.customer_user_id, atau null
 * @param {number|null} input.suggestedBy employees.id PPIC pemberi saran, atau null
 * @param {string} input.logActionType    'CREATE' | 'SUGGEST_CREATE'
 * @param {number|null} input.logActionBy pelaku yang dicatat di log
 * @returns {{ poHeaderId: number, poNumber: string }}
 */
const createPurchaseOrder = async (connection, input) => {
    const {
        customerId, customerCode, items, ppnPercent, status, deliveryAddress, description,
        createdBy = null, suggestedBy = null, logActionType, logActionBy
    } = input;

    // Harga, total, dan PPN dihitung di server dari harga master yang berlaku hari ini.
    const pricing = await priceItems({
        db: connection,
        items,
        poStatus: null,
        existingMap: null,
        ppnPercent
    });

    // Timestamp WIB presisi untuk created_at & updated_at
    const nowWib = getWibDateTimeString();

    await connection.beginTransaction();

    // Kunci baris po_settings sebagai antrean sebelum membaca nomor terakhir.
    await connection.query(
        `SELECT setting_id FROM sipuro_db.po_settings ORDER BY setting_id DESC LIMIT 1 FOR UPDATE`
    );

    const { poNumber } = await generateNextPoNumber(connection, { customer_id: customerId, customerCode });

    const [headerResult] = await connection.query(
        `INSERT INTO sipuro_db.po_headers 
         (po_number, customer_id, subtotal, ppn_percent, total_amount, delivery_address, description, status, created_by, updated_by, suggested_by, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            poNumber,
            customerId,
            pricing.subtotal,
            ppnPercent,
            pricing.totalAmount,
            deliveryAddress || '',
            description,
            status,
            createdBy || null,
            createdBy || null,
            suggestedBy || null,
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

    const poHeaderLogId = await logPOHeader(connection, {
        poHeaderId,
        actionType: logActionType,
        oldStatus: null,
        newStatus: status,
        actionBy: logActionBy
    });

    await logPODetails(connection, poHeaderLogId, insertedDetails);

    await connection.commit();

    return { poHeaderId, poNumber };
};

module.exports = { createPurchaseOrder, findCustomer, getCurrentPpnPercent };
