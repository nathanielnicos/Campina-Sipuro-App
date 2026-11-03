const { sipuroDb: db } = require('../../../config/db');
const { loadRuleFinder } = require('../../../services/upload-trans-type/uploadTransTypeLoader');
const { SCOPE } = require('../../../services/upload-trans-type/uploadTransTypeRules');
const { parseDeliveryOrderExcel } = require('../../../services/delivery-order/deliveryOrderUploadParser');
const { calculateDeliveryOrders, computeDeliveryFingerprint } = require('../../../services/delivery-order/deliveryOrderCalculator');
const { loadDeliveryOrderContext } = require('../../../services/delivery-order/deliveryOrderContextLoader');
const { commitDeliveryOrderTransaction } = require('../../../services/delivery-order/deliveryOrderCommitService');
const { runInLockedTransaction } = require('../../../helpers/lockedTransaction');
const { parseActorId, assertActorExists } = require('../../../helpers/actorHelper');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');

const BUSY_MESSAGE = 'Another upload is being saved. Please try again in a moment.';
const ALREADY_COMMITTED_MESSAGE = 'This delivery order file has already been committed previously.';

// Ubah error duplikat database menjadi pesan yang jelas
const translateDuplicateEntry = (error) => {
    const msg = String(error.sqlMessage || error.message || '');
    if (msg.includes('file_hash') || msg.includes('process_timestamp')) {
        return new BusinessError(ALREADY_COMMITTED_MESSAGE, 409);
    }
    return new BusinessError('Duplicate data detected. Please upload the file again to refresh the preview.', 409);
};

/**
 * Commit upload Delivery Order dan retur (LOGISTIC).
 *
 * Klien mengirim ulang file Excel beserta fingerprint dari preview. Server mem-parse ulang, menghitung ulang
 * di dalam transaksi (di bawah lock bersama dengan upload lot, edit qty, dan approve close), lalu menyimpan
 * hanya jika hasilnya identik dengan preview.
 */
exports.commitDeliveryOrderUpload = async (req, res) => {
    try {
        if (!req.file) {
            throw new BusinessError('Excel file is required.', 400);
        }

        // Pelaku selalu dari token login; userId dari body diabaikan.
        const userId = parseActorId(req);

        const clientFingerprint = String((req.body && req.body.fingerprint) || '').trim();
        if (!clientFingerprint) {
            throw new BusinessError('Preview fingerprint is missing. Please upload the file again.', 400);
        }

        const { processTimestamp, fileHash, rawRows } = parseDeliveryOrderExcel(req.file.buffer, await loadRuleFinder(db, SCOPE.DO));

        const result = await runInLockedTransaction(db, async (connection) => {
            await assertActorExists(connection, userId);

            const [existingLogs] = await connection.query(
                'SELECT id FROM delivery_order_upload_logs WHERE file_hash = ? OR process_timestamp = ? LIMIT 1',
                [fileHash, processTimestamp]
            );
            if (existingLogs.length > 0) {
                throw new BusinessError(ALREADY_COMMITTED_MESSAGE, 409);
            }

            const { existingHashes, allProducts, stock } = await loadDeliveryOrderContext(connection, rawRows, { forUpdate: true });
            const calculation = calculateDeliveryOrders(rawRows, existingHashes, allProducts, stock);

            if (computeDeliveryFingerprint(calculation) !== clientFingerprint) {
                throw new BusinessError(
                    'The result has changed since the preview was generated (for example, a lot allocation was updated). Please upload the file again to review the latest preview.',
                    409
                );
            }

            if (!calculation.canSave) {
                throw new BusinessError('There is no valid delivery order or return to save.', 400);
            }

            return commitDeliveryOrderTransaction(connection, {
                fileName: req.file.originalname,
                processTimestamp,
                fileHash,
                userId,
                calculation
            });
        }, { busyMessage: BUSY_MESSAGE });

        return res.json({
            success: true,
            message: 'Delivery order data successfully saved to database.',
            data: result
        });
    } catch (error) {
        const finalError = error && error.code === 'ER_DUP_ENTRY' ? translateDuplicateEntry(error) : error;

        return sendControllerError(res, finalError, {
            label: 'Commit Delivery Order Upload Error',
            fallbackMessage: 'Failed to save delivery order data. Please try again or contact the administrator.'
        });
    }
};
