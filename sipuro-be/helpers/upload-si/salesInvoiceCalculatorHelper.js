const crypto = require('crypto');
const { generateSiRowHash } = require('./salesInvoiceHashHelper');
const { INTERFACED_STATUS } = require('./salesInvoiceConfig');

const calculateSalesInvoiceMatching = ({ rows = [], productByCode, existingHashes, existingDeliveryOrders }) => {
    // Map DO dari database berdasarkan kombinasi: do_number + product_id
    const doMap = new Map();
    existingDeliveryOrders.forEach(d => {
        doMap.set(`${String(d.do_number).trim().toUpperCase()}_${d.product_id}`, d);
    });

    const validRows = [];
    const unallocatedRows = [];
    const duplicateRows = [];
    const nonInterfacedRows = [];
    const unregisteredRows = [];

    rows.forEach(row => {
        const normItemCode = String(row.itemCode).trim().toUpperCase();
        const normDoNumber = String(row.doNumber).trim().toUpperCase();
        const product = productByCode.get(normItemCode);

        // 1. Cek Interfaced Status
        if (String(row.deliveryStatus || '').trim().toUpperCase() !== INTERFACED_STATUS) {
            nonInterfacedRows.push({ ...row, reason: 'Delivery Status is not INTERFACED.' });
            return;
        }

        // 2. Cek Invoice Number
        if (!row.invoiceNumber) {
            unallocatedRows.push({ ...row, reason: 'Invoice No. is empty.' });
            return;
        }

        // 3. Cek Master SKU
        if (!product) {
            unregisteredRows.push({ ...row, reason: `Item code "${row.itemCode}" is not registered in master products.` });
            return;
        }

        // 4. Cek Duplikasi (SI sudah pernah disimpan)
        const rowHash = generateSiRowHash(row.invoiceNumber, row.doNumber, product.id_product);
        if (existingHashes.has(rowHash)) {
            duplicateRows.push({ ...row, rowHash, reason: 'This Sales Invoice has already been saved previously.' });
            return;
        }

        // 5. Pencocokan ke DO (MATCHING KE DELIVERY_ORDERS)
        const doMatch = doMap.get(`${normDoNumber}_${product.id_product}`);
        if (!doMatch) {
            unallocatedRows.push({
                ...row,
                reason: `Delivery Order "${row.doNumber}" for item "${row.itemCode}" is not found in database. Please upload DO first.`
            });
            return;
        }

        // 6. VALID: Berhasil dicocokkan ke DO
        const pcsPerCtn = Number(product.pcs_per_ctn) || 1;
        const qtyPcs = Number((row.qtyCtn * pcsPerCtn).toFixed(2));

        validRows.push({
            ...row,
            rowHash,
            productId: product.id_product,
            productCode: product.product_code,
            productName: product.product_name,
            pcsPerCtn,
            qtyPcs,
            deliveryOrderId: doMatch.delivery_order_id,
            doCreatedDate: doMatch.do_created_date
        });
    });

    return {
        validRows,
        unallocatedRows,
        duplicateRows,
        nonInterfacedRows,
        unregisteredRows,
        summary: {
            totalRows: rows.length,
            validCount: validRows.length,
            unallocatedCount: unallocatedRows.length,
            duplicateCount: duplicateRows.length,
            nonInterfacedCount: nonInterfacedRows.length,
            unregisteredCount: unregisteredRows.length
        },
        canSave: validRows.length > 0
    };
};

const computeSiFingerprint = (calculation, fileHash) => {
    const payload = {
        fileHash,
        valid: calculation.validRows.map(r => [r.rowHash, r.invoiceNumber, r.doNumber, r.qtyCtn, r.deliveryOrderId])
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

module.exports = {
    calculateSalesInvoiceMatching,
    computeSiFingerprint
};
