'use strict';

/**
 * Menyimpan hasil upload Delivery Order dan retur (dipanggil di dalam transaksi yang sudah terkunci).
 *  - delivery_order_upload_logs / _details : log file dan HANYA baris yang diproses (baris ditolak tidak disimpan)
 *  - delivery_orders                       : nomor DO unik (tanggal dan jam paling awal)
 *  - delivery_order_lots                   : satu baris per (DO, item, lot) per upload
 *  - delivery_returns                      : satu baris per (nomor retur, item, lot) per upload
 * Tidak mengubah po_details maupun po_lot_allocations.
 */

const { chunk } = require('../../helpers/arrayUtils');
const { TRANS_TYPE } = require('./deliveryOrderRules');

const insertInChunks = async (connection, sql, rows) => {
    for (const part of chunk(rows, 500)) {
        await connection.query(sql, [part]);
    }
};

const earliestByDoNumber = (doLines) => {
    const map = new Map();
    doLines.forEach((l) => {
        const current = map.get(l.referenceNum);
        if (!current || l.transDateTime < current) map.set(l.referenceNum, l.transDateTime);
    });
    return map;
};

const commitDeliveryOrderTransaction = async (connection, { fileName, processTimestamp, fileHash, userId, calculation }) => {
    const { categorizedDetails, doLines, returnLines } = calculation;

    const [logResult] = await connection.query(
        'INSERT INTO delivery_order_upload_logs (file_name, process_timestamp, file_hash, uploaded_by) VALUES (?, ?, ?, ?)',
        [fileName, processTimestamp, fileHash, userId]
    );
    const uploadLogId = logResult.insertId;

    // 1. Baris Excel yang diproses
    await insertInChunks(
        connection,
        `INSERT INTO delivery_order_upload_details
         (upload_log_id, trans_type, trans_datetime, item_code, lot_number, reference_num, qty_in, qty_out, row_hash)
         VALUES ?`,
        categorizedDetails.newRows.map((r) => {
            const isIssue = r.transType === TRANS_TYPE.ISSUE;
            return [
                uploadLogId, r.transType, r.transDateTime, r.itemCode, r.lotNumber, r.referenceNum,
                isIssue ? 0 : r.qty, isIssue ? r.qty : 0, r.rowHash
            ];
        })
    );

    // 2. Nomor DO unik: DO yang sudah ada hanya memajukan tanggal paling awal
    const doDates = earliestByDoNumber(doLines);
    const doNumbers = [...doDates.keys()];
    const idByDoNumber = new Map();

    if (doNumbers.length > 0) {
        await insertInChunks(
            connection,
            `INSERT INTO delivery_orders (do_number, do_datetime, first_upload_log_id) VALUES ?
             ON DUPLICATE KEY UPDATE do_datetime = LEAST(do_datetime, VALUES(do_datetime))`,
            doNumbers.map((n) => [n, doDates.get(n), uploadLogId])
        );
        for (const part of chunk(doNumbers, 500)) {
            const [rows] = await connection.query('SELECT id, do_number FROM delivery_orders WHERE do_number IN (?)', [part]);
            rows.forEach((r) => idByDoNumber.set(r.do_number, r.id));
        }

        // 3. Baris DO per item dan lot
        await insertInChunks(
            connection,
            `INSERT INTO delivery_order_lots
             (delivery_order_id, product_id, lot_number, qty_pcs, qty_ctn, do_datetime, upload_log_id) VALUES ?`,
            doLines.map((l) => [idByDoNumber.get(l.referenceNum), l.productId, l.lotNumber, l.qtyPcs, l.qtyCtn, l.transDateTime, uploadLogId])
        );
    }

    // 4. Retur
    await insertInChunks(
        connection,
        `INSERT INTO delivery_returns
         (return_number, product_id, lot_number, qty_pcs, qty_ctn, return_datetime, upload_log_id) VALUES ?`,
        returnLines.map((l) => [l.referenceNum, l.productId, l.lotNumber, l.qtyPcs, l.qtyCtn, l.transDateTime, uploadLogId])
    );

    return {
        uploadLogId,
        savedDoCount: doNumbers.length,
        savedDoLineCount: doLines.length,
        savedReturnCount: returnLines.length,
        savedRowCount: categorizedDetails.newRows.length
    };
};

module.exports = { commitDeliveryOrderTransaction };
