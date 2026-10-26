const crypto = require('crypto');
const { BusinessError } = require('../businessError');

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const commitDeliveryOrderTransaction = async (connection, {
    fileName,
    processTimestamp,
    fileHash,
    userId,
    calculation
}) => {
    const { allocatedDoGroups, categorizedDetails } = calculation;

    // 1. Validasi K1 agar tidak upload ganda
    const [existing] = await connection.query(
        'SELECT id FROM delivery_order_upload_logs WHERE process_timestamp = ? OR file_hash = ? LIMIT 1',
        [processTimestamp, fileHash]
    );
    if (existing.length > 0) {
        throw new BusinessError(
            `File with process timestamp "${processTimestamp}" has already been uploaded previously.`,
            409
        );
    }

    // Insert Log Upload DO
    const [uploadLog] = await connection.query(
        'INSERT INTO delivery_order_upload_logs (file_name, process_timestamp, file_hash, uploaded_by) VALUES (?, ?, ?, ?)',
        [fileName, processTimestamp, fileHash, userId]
    );
    const uploadLogId = uploadLog.insertId;

    // 2. Simpan Detail Upload DO
    const validRows = categorizedDetails.newRows;
    for (const part of chunk(validRows, 500)) {
        const detailValues = part.map((r) => [
            uploadLogId,
            r.transType,
            r.transDate,
            r.itemCode,
            r.lotNumber,
            r.shipmentNum,
            r.qtyIn || 0,
            r.qtyOut || 0,
            r.rowHash
        ]);
        await connection.query(
            `INSERT INTO delivery_order_upload_details 
             (upload_log_id, trans_type, trans_date, item_code, lot_number, shipment_num, qty_in, qty_out, row_hash) 
             VALUES ?`,
            [detailValues]
        );
    }

    // 3. Simpan ke `delivery_orders` dan `delivery_order_allocations`
    const touchedPoDetailIds = new Set();

    for (const { group, doAllocations } of allocatedDoGroups) {
        // Ambil ID Product & pcs_per_ctn
        const [pRows] = await connection.query(
            'SELECT id_product, pcs_per_ctn FROM products WHERE product_code = ? LIMIT 1',
            [group.itemCode]
        );
        const productId = pRows[0]?.id_product;
        const pcsPerCtn = Number(pRows[0]?.pcs_per_ctn) || 1;
        const qtyCtn = pcsPerCtn > 0 ? (group.totalQty / pcsPerCtn).toFixed(2) : 0;

        for (const alloc of doAllocations) {
            touchedPoDetailIds.add(alloc.poDetailId);

            // Hash SHA256 tepat 64 char
            const doRowHash = crypto.createHash('sha256')
                .update(`${group.shipmentNum}_${alloc.poLotAllocationId}_${uploadLogId}`)
                .digest('hex');

            // Simpan ke delivery_orders murni (kolom redundan sudah dibuang)
            const [doResult] = await connection.query(
                `INSERT INTO delivery_orders 
                 (import_log_id, do_number, do_created_date, customer_po_text, product_id, qty_ctn, qty_pcs, row_hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    uploadLogId,
                    group.shipmentNum,
                    group.transDate, // do_created_date dari Trans Date Excel
                    alloc.customerPoText || null,
                    productId,
                    qtyCtn,
                    alloc.qtyPcs,
                    doRowHash
                ]
            );
            const deliveryOrderId = doResult.insertId;

            // Simpan relasi ke delivery_order_allocations
            await connection.query(
                `INSERT INTO delivery_order_allocations (delivery_order_id, po_lot_allocation_id, qty_pcs)
                 VALUES (?, ?, ?)`,
                [deliveryOrderId, alloc.poLotAllocationId, alloc.qtyPcs]
            );
        }
    }

    // 4. Hitung Ulang `delivered_qty` pada `po_details`
    const poDetailIds = [...touchedPoDetailIds];
    if (poDetailIds.length > 0) {
        await connection.query(
            `UPDATE po_details d
             SET d.delivered_qty = (
                 SELECT COALESCE(SUM(doa.qty_pcs), 0)
                 FROM delivery_order_allocations doa
                 JOIN po_lot_allocations pla ON doa.po_lot_allocation_id = pla.id
                 WHERE pla.po_detail_id = d.po_detail_id
             )
             WHERE d.po_detail_id IN (?)`,
            [poDetailIds]
        );
    }

    return {
        uploadLogId,
        savedDoCount: allocatedDoGroups.length,
        savedRowCount: validRows.length
    };
};

module.exports = {
    commitDeliveryOrderTransaction
};
