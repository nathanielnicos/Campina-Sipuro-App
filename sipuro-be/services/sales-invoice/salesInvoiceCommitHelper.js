const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const commitSalesInvoiceTransaction = async (connection, { fileName, fileHash, processTimestamp, userId, calculation }) => {
    const { validRows, summary } = calculation;

    // 1. Simpan Log Import
    const [logResult] = await connection.query(
        `INSERT INTO document_import_logs
            (file_name, file_hash, process_timestamp, uploaded_by, total_rows, valid_rows, duplicate_rows, unregistered_rows, non_interfaced_rows)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            fileName,
            fileHash,
            processTimestamp,
            String(userId),
            summary.totalRows,
            summary.validCount,
            summary.duplicateCount,
            summary.unregisteredCount,
            summary.nonInterfacedCount
        ]
    );
    const importLogId = logResult.insertId;

    // 2. Simpan ke tabel `sales_invoices` (mengikat delivery_order_id yang sudah dicocokkan)
    for (const part of chunk(validRows, 200)) {
        const values = part.map(r => [
            importLogId,
            r.deliveryOrderId,
            r.doNumber,
            r.invoiceNumber,
            r.siDate,
            r.pickUpDate,
            r.productId,
            r.qtyCtn,
            r.qtyPcs,
            r.rowHash
        ]);

        await connection.query(
            `INSERT INTO sales_invoices
                (import_log_id, delivery_order_id, do_number, si_number, si_date, pick_up_date, product_id, qty_ctn, qty_pcs, row_hash)
             VALUES ?`,
            [values]
        );
    }

    return {
        importLogId,
        savedSalesInvoiceCount: validRows.length
    };
};

module.exports = { commitSalesInvoiceTransaction };
