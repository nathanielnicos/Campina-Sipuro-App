const { sipuroDb: db } = require('../../../config/db');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');
const { parseSalesInvoiceExcel } = require('../../../helpers/upload-si/salesInvoiceParserHelper');
const { loadSalesInvoiceContext } = require('../../../helpers/upload-si/salesInvoiceDataLoader');
const { calculateSalesInvoiceMatching, computeSiFingerprint } = require('../../../helpers/upload-si/salesInvoiceCalculatorHelper');

exports.previewSalesInvoiceUpload = async (req, res) => {
    try {
        if (!req.file) throw new BusinessError('Excel file is required.', 400);

        const { fileHash, processTimestamp, rows } = parseSalesInvoiceExcel(req.file.buffer);

        // Cek duplikasi upload
        const [existingLogs] = await db.query(
            'SELECT id FROM document_import_logs WHERE file_hash = ? OR process_timestamp = ? LIMIT 1',
            [fileHash, processTimestamp]
        );
        const isReupload = existingLogs.length > 0;

        const context = await loadSalesInvoiceContext(db, rows);
        const calculation = calculateSalesInvoiceMatching({ rows, ...context });

        return res.json({
            success: true,
            data: {
                fileName: req.file.originalname,
                fileHash,
                processTimestamp,
                isReupload,
                warningMessage: isReupload ? 'This file or timestamp has been uploaded previously.' : null,
                fingerprint: computeSiFingerprint(calculation, fileHash),
                ...calculation
            }
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Preview Sales Invoice Error',
            fallbackMessage: 'Failed to process Sales Invoice Excel file.'
        });
    }
};
