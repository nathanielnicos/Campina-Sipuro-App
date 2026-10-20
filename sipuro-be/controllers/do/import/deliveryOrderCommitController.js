const { sipuroDb: db } = require('../../../config/db');
const { parseDeliveryOrderExcel } = require('../../../helpers/upload-do/deliveryOrderParserHelper');
const { loadDeliveryOrderContext } = require('../../../helpers/upload-do/deliveryOrderDataLoader');
const { calculateDeliveryOrderFifo } = require('../../../helpers/upload-do/deliveryOrderCalculatorHelper');
const { commitDeliveryOrderTransaction } = require('../../../helpers/upload-do/deliveryOrderCommitHelper');
const { computeDoFingerprint } = require('./deliveryOrderPreviewController');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');

const DO_COMMIT_LOCK_NAME = 'DO_UPLOAD_COMMIT_LOCK';
const DO_LOCK_TIMEOUT_SECONDS = 30;

const translateDoDuplicateEntry = (error) => {
    const msg = String(error.sqlMessage || error.message || '');
    if (msg.includes('file_hash') || msg.includes('process_timestamp')) {
        return new BusinessError('This DO allocation file has already been committed previously.', 409);
    }
    if (msg.includes('row_hash')) {
        return new BusinessError('Duplicate Delivery Order records detected in this file.', 409);
    }
    return new BusinessError('Duplicate data detected. Please upload the file again to refresh the preview.', 409);
};

/**
 * Commit / Simpan Hasil Mapping DO ke Lot
 */
exports.commitDeliveryOrderAllocation = async (req, res) => {
    let connection = null;
    let lockAcquired = false;
    let inTransaction = false;

    try {
        if (!req.file) {
            throw new BusinessError('Excel file is required.', 400);
        }

        const userId = Number.parseInt(req.user && req.user.id, 10);
        if (!Number.isInteger(userId) || userId <= 0) {
            throw new BusinessError('A valid user is required. Please log in again.', 400);
        }

        const clientFingerprint = String(req.body.fingerprint || '').trim();
        if (!clientFingerprint) {
            throw new BusinessError('Preview fingerprint is missing. Please upload the file again.', 400);
        }

        const { processTimestamp, fileHash, rawRows } = parseDeliveryOrderExcel(req.file.buffer);

        connection = await db.getConnection();

        // Kunci proses upload DO agar berjalan berurutan
        const [[lockRow]] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [
            DO_COMMIT_LOCK_NAME,
            DO_LOCK_TIMEOUT_SECONDS
        ]);
        if (!lockRow || Number(lockRow.acquired) !== 1) {
            throw new BusinessError('Another DO upload is being processed. Please try again in a moment.', 409);
        }
        lockAcquired = true;

        await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await connection.beginTransaction();
        inTransaction = true;

        const [employeeRows] = await connection.query('SELECT id FROM employees WHERE id = ? LIMIT 1', [userId]);
        if (employeeRows.length === 0) {
            throw new BusinessError('User not found. Please log in again.', 400);
        }

        // Cek log upload DO
        const [existingLogs] = await connection.query(
            'SELECT id FROM delivery_order_upload_logs WHERE file_hash = ? OR process_timestamp = ? LIMIT 1',
            [fileHash, processTimestamp]
        );
        if (existingLogs.length > 0) {
            throw new BusinessError('This DO allocation file has already been committed previously.', 409);
        }

        // Muat konteks data dengan lock FOR UPDATE
        const { allProducts, existingHashes, openLotAllocations } = await loadDeliveryOrderContext(
            connection,
            rawRows,
            { forUpdate: true }
        );

        // Hitung ulang kalkulasi di server
        const calculation = calculateDeliveryOrderFifo(rawRows, existingHashes, openLotAllocations, allProducts);

        // Validasi fingerprint
        if (computeDoFingerprint(calculation) !== clientFingerprint) {
            throw new BusinessError(
                'The DO allocation result has changed since the preview was generated. Please upload the file again.',
                409
            );
        }

        if (!calculation.canSave) {
            throw new BusinessError('There is no valid DO allocation to save.', 400);
        }

        // Simpan ke database
        const result = await commitDeliveryOrderTransaction(connection, {
            fileName: req.file.originalname,
            processTimestamp,
            fileHash,
            userId,
            calculation
        });

        await connection.commit();
        inTransaction = false;

        return res.json({
            success: true,
            message: 'Delivery order allocations successfully saved to database.',
            data: result
        });
    } catch (error) {
        if (connection && inTransaction) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }

        const finalError = error && error.code === 'ER_DUP_ENTRY' ? translateDoDuplicateEntry(error) : error;

        return sendControllerError(res, finalError, {
            label: 'Commit Delivery Order Error',
            fallbackMessage: 'Failed to save delivery order allocation. Please try again.'
        });
    } finally {
        if (connection) {
            if (lockAcquired) {
                try {
                    await connection.query('SELECT RELEASE_LOCK(?)', [DO_COMMIT_LOCK_NAME]);
                } catch (releaseError) {
                    console.error('Release lock failed:', releaseError);
                }
            }
            connection.release();
        }
    }
};
