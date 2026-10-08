const xlsx = require('xlsx');
const { extractPONumbers } = require('./poExtractorHelper');
const { generateRowHash } = require('./hashGeneratorHelper');

const parseDocumentFlowExcel = async (fileBuffer, db) => {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Mengubah sheet ke JSON array (baris header dimulai pada baris ke-7 / index 6)
    const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, range: 6 });

    // Ambil master products untuk lookup pcs_per_ctn
    const [products] = await db.query('SELECT id, product_code, pcs_per_ctn FROM products');
    const productMap = new Map(products.map(p => [p.product_code.toUpperCase(), p]));

    const parsedData = [];
    const unregisteredSKUs = new Set();

    for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0) continue;

        const productCode = row[5] ? String(row[5]).trim() : null; // Col 6: Item
        const rawPO = row[10] ? String(row[10]).trim() : '';      // Col 11: Customer PO
        const doNumber = row[16] ? String(row[16]).trim() : null;  // Col 17: Delivery No
        const qtyCtnDO = parseFloat(row[18]) || 0;                // Col 19: Qty Delivery
        const pickUpDate = row[20] ? new Date(row[20]) : null;     // Col 21: Pick Up Date
        const siNumber = row[24] ? String(row[24]).trim() : null;  // Col 25: Invoice No
        const qtyCtnSI = parseFloat(row[26]) || 0;                // Col 27: Qty Invoice (CAR)
        const glDate = row[28] ? new Date(row[28]) : null;         // Col 29: GL Date
        const doCreatedDate = row[40] ? new Date(row[40]) : null;  // Col 41: DO Creation Date

        if (!productCode) continue;

        const productInfo = productMap.get(productCode.toUpperCase());
        if (!productInfo) {
            unregisteredSKUs.add(productCode);
            continue;
        }

        const pcsPerCtn = parseFloat(productInfo.pcs_per_ctn) || 1;
        const candidatePOs = extractPONumbers(rawPO);

        const rowItem = {
            rowIndex: i + 7,
            productId: productInfo.id,
            productCode,
            candidatePOs,
            rawPO,
            doNumber,
            doCreatedDate,
            pickUpDate,
            qtyCtnDO,
            qtyPcsDO: qtyCtnDO * pcsPerCtn,
            siNumber,
            siDate: glDate,
            qtyCtnSI,
            qtyPcsSI: qtyCtnSI * pcsPerCtn,
            rowHashDO: generateRowHash({ doNumber, productCode, qtyCtnDO, doCreatedDate }),
            rowHashSI: generateRowHash({ siNumber, productCode, qtyCtnSI, glDate })
        };

        parsedData.push(rowItem);
    }

    return { parsedData, unregisteredSKUs: Array.from(unregisteredSKUs) };
};

module.exports = { parseDocumentFlowExcel };
