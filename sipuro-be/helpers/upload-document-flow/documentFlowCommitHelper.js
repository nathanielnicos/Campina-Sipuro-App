/**
 * Saves the result of calculateDocumentFlow. Called INSIDE the transaction (BEGIN / COMMIT / ROLLBACK
 * are handled by the controller). `calculation` has just been recalculated by the server from the
 * uploaded file in this same transaction, never taken from the client.
 *
 * Only previewResults (the "Valid Data" card) are saved. The production allocation tables
 * (po_batch_allocations: allocated_qty, status; po_details: fulfilled_qty, status) are never changed.
 */
const { BusinessError } = require('../businessError');
const { INSERT_CHUNK_SIZE } = require('./documentFlowConfig');

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const commitDocumentFlowTransaction = async (connection, { fileName, fileHash, processTimestamp, userId, calculation }) => {
    const { previewResults, summary } = calculation;

    // 1. Import log (UNIQUE file_hash / process_timestamp protects against a double commit)
    const [logResult] = await connection.query(
        `INSERT INTO document_import_logs
            (file_name, file_hash, process_timestamp, uploaded_by,
             total_rows, valid_rows, duplicate_rows, unregistered_rows, non_interfaced_rows, canceled_invoice_rows)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            String(fileName || 'unnamed file').slice(0, 255),
            fileHash,
            String(processTimestamp).slice(0, 50),
            String(userId),
            summary.totalRows,
            summary.validCount,
            summary.duplicateCount,
            summary.unregisteredCount,
            summary.nonInterfacedCount,
            summary.canceledInvoiceCount
        ]
    );
    const importLogId = logResult.insertId;

    // 2. Delivery orders
    for (const part of chunk(previewResults, INSERT_CHUNK_SIZE)) {
        await connection.query(
            `INSERT INTO delivery_orders
                (import_log_id, po_batch_allocation_id, po_number, customer_po_text, po_created_date,
                 do_number, do_created_date, pick_up_date, product_id, qty_ctn, qty_pcs, row_hash)
             VALUES ?`,
            [part.map((r) => [
                importLogId,
                null,
                null,
                String(r.customerPoText || '').slice(0, 255),
                null,
                r.doNumber,
                r.doCreatedAt,
                r.pickUpDate,
                r.productId,
                r.qtyCtnDO,
                r.qtyPcs,
                r.rowHashDO
            ])]
        );
    }

    const [savedDos] = await connection.query(
        'SELECT id, row_hash FROM delivery_orders WHERE import_log_id = ?',
        [importLogId]
    );
    const doIdByHash = new Map(savedDos.map((d) => [d.row_hash, d.id]));
    if (doIdByHash.size !== previewResults.length) {
        throw new BusinessError('The saved delivery orders do not match the preview. Please upload the file again.', 409);
    }

    // 3. DO -> batch allocation lines
    const allocationValues = [];
    previewResults.forEach((r) => {
        const doId = doIdByHash.get(r.rowHashDO);
        r.allocations.forEach((a) => allocationValues.push([doId, a.allocationId, a.qtyPcs]));
    });
    for (const part of chunk(allocationValues, INSERT_CHUNK_SIZE)) {
        await connection.query(
            'INSERT INTO delivery_order_allocations (delivery_order_id, po_batch_allocation_id, qty_pcs) VALUES ?',
            [part]
        );
    }

    // 4. Sales invoices
    for (const part of chunk(previewResults, INSERT_CHUNK_SIZE)) {
        await connection.query(
            `INSERT INTO sales_invoices
                (import_log_id, delivery_order_id, do_number, si_number, si_date, pick_up_date, product_id, qty_ctn, qty_pcs, row_hash)
             VALUES ?`,
            [part.map((r) => [
                importLogId,
                doIdByHash.get(r.rowHashDO),
                r.doNumber,
                r.invoiceNumber,
                r.siDate,
                r.pickUpDate,
                r.productId,
                r.qtyCtnSI,
                r.qtyPcs,
                r.rowHashSI
            ])]
        );
    }

    // 5. Recalculate po_details.delivered_qty (total of all DO allocation lines, in pcs)
    const poDetailIds = [...new Set(previewResults.flatMap((r) => r.allocations.map((a) => a.poDetailId)))];
    if (poDetailIds.length > 0) {
        await connection.query(
            `UPDATE po_details d
             SET d.delivered_qty = (
                 SELECT COALESCE(SUM(doa.qty_pcs), 0)
                 FROM delivery_order_allocations doa
                 JOIN po_batch_allocations pba ON pba.id = doa.po_batch_allocation_id
                 WHERE pba.po_detail_id = d.po_detail_id
             )
             WHERE d.po_detail_id IN (?)`,
            [poDetailIds]
        );
    }

    return {
        importLogId,
        savedDeliveryOrderCount: previewResults.length,
        savedSalesInvoiceCount: previewResults.length,
        allocationLineCount: allocationValues.length
    };
};

module.exports = { commitDocumentFlowTransaction };
