const { sipuroDb: db } = require('../../../config/db');
const { parseProductionExcel } = require('../../../helpers/productionParserHelper');
const { calculateFifoAllocation, computeAllocationFingerprint } = require('../../../helpers/productionCalculatorHelper');
const { loadProductionContext } = require('../../../helpers/productionDataLoader');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');

/**
 * Preview Upload Excel Production (PPIC) - Automatic FIFO based on po_headers.created_at ASC
 */
exports.previewExcelUpload = async (req, res) => {
    try {
        if (!req.file) {
            throw new BusinessError('Excel file is required.', 400);
        }

        const { processTimestamp, fileHash, rawRows } = parseProductionExcel(req.file.buffer);

        // Aturan file duplikat: hash ATAU process timestamp sama (sama dengan commit)
        const [existingLogs] = await db.query(
            'SELECT id, uploaded_at FROM production_upload_logs WHERE process_timestamp = ? OR file_hash = ?',
            [processTimestamp, fileHash]
        );
        const isAlreadyUploaded = existingLogs && existingLogs.length > 0;

        const { existingHashes, openPoDetails, allProducts, context } = await loadProductionContext(db, rawRows);

        const calculationResult = calculateFifoAllocation(
            rawRows,
            existingHashes,
            openPoDetails,
            allProducts,
            context
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
                // Dikirim kembali saat commit; server menolak jika hasil hitung ulang berbeda
                fingerprint: computeAllocationFingerprint(calculationResult),
                ...calculationResult
            }
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Preview Production Upload Error',
            fallbackMessage: 'Failed to process the Excel file. Please try again or contact the administrator.'
        });
    }
};
