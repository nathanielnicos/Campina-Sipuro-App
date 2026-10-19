const { sipuroDb: db } = require('../../../config/db');
const { parseProductionExcel } = require('../../../helpers/upload-production-lot/productionLotParserHelper');
const { calculateLotFifoAllocation, computeAllocationFingerprint } = require('../../../helpers/upload-production-lot/productionLotCalculatorHelper');
const { loadProductionLotContext } = require('../../../helpers/upload-production-lot/productionLotDataLoader');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');

/**
 * Preview Upload Excel Production (Lot-Centric) - Automatic FIFO based on po_headers.created_at ASC
 */
exports.previewExcelUpload = async (req, res) => {
    try {
        if (!req.file) {
            throw new BusinessError('Excel file is required.', 400);
        }

        const { processTimestamp, fileHash, rawRows } = parseProductionExcel(req.file.buffer);

        // Aturan file duplikat: hash ATAU process timestamp sama (mengacu pada tabel log lot baru)
        const [existingLogs] = await db.query(
            'SELECT id, uploaded_at FROM production_lot_upload_logs WHERE process_timestamp = ? OR file_hash = ?',
            [processTimestamp, fileHash]
        );
        const isAlreadyUploaded = existingLogs && existingLogs.length > 0;

        const { existingHashes, openPoDetails, allProducts, context } = await loadProductionLotContext(db, rawRows);

        const calculationResult = calculateLotFifoAllocation(
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
                allocationMode: 'FIFO_LOT_CREATED_AT_ASC',
                isReupload: isAlreadyUploaded,
                warningMessage: isAlreadyUploaded ? 'This file or timestamp has been uploaded previously.' : null,
                // Dikirim kembali saat commit; server menolak jika hasil hitung ulang berbeda
                fingerprint: computeAllocationFingerprint(calculationResult),
                ...calculationResult
            }
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Preview Production Lot Upload Error',
            fallbackMessage: 'Failed to process the Excel file. Please try again or contact the administrator.'
        });
    }
};
