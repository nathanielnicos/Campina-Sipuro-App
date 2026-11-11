const { sipuroDb: db } = require('../../../config/db');
const { loadRuleFinder } = require('../../../services/upload-trans-type/uploadTransTypeLoader');
const { SCOPE } = require('../../../services/upload-trans-type/uploadTransTypeRules');
const { loadUploadFormat } = require('../../../services/upload-format/uploadFormatLoader');
const { parseDeliveryOrderExcel } = require('../../../services/delivery-order/deliveryOrderUploadParser');
const { calculateDeliveryOrders, computeDeliveryFingerprint } = require('../../../services/delivery-order/deliveryOrderCalculator');
const { loadDeliveryOrderContext } = require('../../../services/delivery-order/deliveryOrderContextLoader');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');

/**
 * Preview upload Excel Delivery Order dan retur (LOGISTIC). Tidak menyimpan apa pun.
 */
exports.previewDeliveryOrderUpload = async (req, res) => {
    try {
        if (!req.file) {
            throw new BusinessError('Excel file is required.', 400);
        }

        const { processTimestamp, fileHash, rawRows, skippedRowCount = 0, skippedTransTypes = [] } = parseDeliveryOrderExcel(
            req.file.buffer,
            await loadRuleFinder(db, SCOPE.DO),
            await loadUploadFormat(db, SCOPE.DO)
        );

        // Aturan file duplikat: hash ATAU process timestamp sama
        const [existingLogs] = await db.query(
            'SELECT id FROM delivery_order_upload_logs WHERE process_timestamp = ? OR file_hash = ? LIMIT 1',
            [processTimestamp, fileHash]
        );
        const isAlreadyUploaded = existingLogs.length > 0;

        const { existingHashes, allProducts, stock } = await loadDeliveryOrderContext(db, rawRows);
        const calculation = calculateDeliveryOrders(rawRows, existingHashes, allProducts, stock);

        return res.json({
            success: true,
            data: {
                processTimestamp,
                fileHash,
                fileName: req.file.originalname,
                isReupload: isAlreadyUploaded,
                warningMessage: isAlreadyUploaded ? 'This file or timestamp has been uploaded previously.' : null,
                // Dikirim kembali saat commit; server menolak jika hasil hitung ulang berbeda
                fingerprint: computeDeliveryFingerprint(calculation),
                // Baris Excel yang dilewati karena Trans Type tidak dikenali (tidak ikut dihitung)
                skippedRowCount,
                skippedTransTypes,
                ...calculation
            }
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Preview Delivery Order Upload Error',
            fallbackMessage: 'Failed to process the Excel file. Please try again or contact the administrator.'
        });
    }
};
