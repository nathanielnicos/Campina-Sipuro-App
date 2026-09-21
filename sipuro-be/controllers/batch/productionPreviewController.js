const { sipuroDb: db } = require('../../config/db');
const { parseProductionExcel } = require('../../helpers/productionParserHelper');
const { calculateFifoAllocation } = require('../../helpers/productionCalculatorHelper');
const { getPOTolerance } = require('../../helpers/batchHelper');

/**
 * Preview Upload Excel Production (PPIC) - Automatic FIFO based on po_headers.created_at ASC
 */
exports.previewExcelUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Excel file is required.' });
        }

        const { processTimestamp, fileHash, rawRows } = parseProductionExcel(req.file.buffer);

        const [existingLogs] = await db.query(
            'SELECT id, uploaded_at FROM production_upload_logs WHERE process_timestamp = ? OR file_hash = ?',
            [processTimestamp, fileHash]
        );
        const isAlreadyUploaded = existingLogs && existingLogs.length > 0;

        // Fetch existing row_hash from DB
        const [existingHashRows] = await db.query(
            'SELECT row_hash FROM production_upload_details'
        );
        const existingHashes = existingHashRows ? existingHashRows.map(row => row.row_hash) : [];

        // Fetch active PO details eligible for allocation (JOIN po_details -> po_headers -> products)
        const [openPoDetails] = await db.query(`
            SELECT 
                pd.po_detail_id,
                pd.po_header_id,
                pd.id_product,
                pd.base_qty,
                pd.fulfilled_qty,
                ph.po_number,
                ph.created_at,
                ph.status AS header_status,
                p.product_code,
                p.product_name
            FROM po_details pd
            JOIN po_headers ph ON pd.po_header_id = ph.po_header_id
            JOIN products p ON pd.id_product = p.id_product
            WHERE pd.deleted_at IS NULL 
              AND ph.status NOT IN ('Canceled', 'Closed', 'Force Closed')
            ORDER BY ph.created_at ASC
        `);

        const [allProducts] = await db.query('SELECT id_product, product_code, product_name FROM products');
        const poTolerance = await getPOTolerance(db);

        const {
            categorizedDetails,
            summary,
            previewResults,
            unallocatedStocks,
            detailedAllocations
        } = calculateFifoAllocation(
            rawRows,
            existingHashes,
            openPoDetails || [],
            allProducts || [],
            poTolerance
        );

        return res.json({
            success: true,
            data: {
                processTimestamp,
                fileHash,
                fileName: req.file.originalname,
                allocationMode: 'FIFO_CREATED_AT_ASC',
                isReupload: isAlreadyUploaded,
                warningMessage: isAlreadyUploaded ? 'This file or timestamp has been uploaded previously.' : null,
                summary,
                categorizedDetails,
                previewResults,
                unallocatedStocks,
                detailedAllocations
            }
        });

    } catch (error) {
        console.error('Preview Production Upload Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to process Excel file: ' + error.message });
    }
};
