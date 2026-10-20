const { sipuroDb: db } = require('../../../config/db');
const { parseProductionExcel } = require('../../../helpers/upload-production-lot/productionLotParserHelper');
const { calculateLotFifoAllocation, computeAllocationFingerprint } = require('../../../helpers/upload-production-lot/productionLotCalculatorHelper');
const { loadProductionLotContext } = require('../../../helpers/upload-production-lot/productionLotDataLoader');
const { commitProductionAllocationTransaction } = require('../../../helpers/upload-production-lot/productionLotCommitHelper');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');
const { COMMIT_LOCK_NAME, COMMIT_LOCK_TIMEOUT_SECONDS } = require('../../../helpers/uploadConfig');

// Ubah error duplikat database menjadi pesan yang jelas
const translateDuplicateEntry = (error) => {
    const msg = String(error.sqlMessage || error.message || '');
    if (msg.includes('file_hash') || msg.includes('process_timestamp')) {
        return new BusinessError('This production lot allocation file has already been committed previously.', 409);
    }
    if (msg.includes('batch_number') || msg.includes('lot_number')) {
        return new BusinessError('A batch or lot number was created by another process. Please upload the file again to refresh the preview.', 409);
    }
    return new BusinessError('Duplicate data detected. Please upload the file again to refresh the preview.', 409);
};

/**
 * Commit / Save Production Lot Allocation Results (PPIC)
 *
 * Client mengirim ulang file Excel (multipart) beserta fingerprint dari preview.
 * Server mem-parse ulang, menghitung ulang alokasi lot di dalam transaksi (dengan lock),
 * lalu menyimpan hanya jika hasilnya identik dengan preview.
 */
exports.commitExcelAllocation = async (req, res) => {
    let connection = null;
    let lockAcquired = false;
    let inTransaction = false;

    try {
        if (!req.file) {
            throw new BusinessError('Excel file is required.', 400);
        }

        // Pelaku selalu dari token login; userId dari body diabaikan.
        const userId = Number.parseInt(req.user && req.user.id, 10);
        if (!Number.isInteger(userId) || userId <= 0) {
            throw new BusinessError('A valid user is required. Please log in again.', 400);
        }

        const clientFingerprint = String(req.body.fingerprint || '').trim();
        if (!clientFingerprint) {
            throw new BusinessError('Preview fingerprint is missing. Please upload the file again.', 400);
        }

        const { processTimestamp, fileHash, rawRows } = parseProductionExcel(req.file.buffer);

        connection = await db.getConnection();

        // Commit upload berjalan satu per satu (lintas instance serverless)
        const [[lockRow]] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [
            COMMIT_LOCK_NAME,
            COMMIT_LOCK_TIMEOUT_SECONDS
        ]);
        if (!lockRow || Number(lockRow.acquired) !== 1) {
            throw new BusinessError('Another production lot upload is being saved. Please try again in a moment.', 409);
        }
        lockAcquired = true;

        // READ COMMITTED: setelah baris dikunci, pembacaan berikutnya selalu melihat data terbaru
        await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await connection.beginTransaction();
        inTransaction = true;

        const [employeeRows] = await connection.query('SELECT id FROM employees WHERE id = ? LIMIT 1', [userId]);
        if (employeeRows.length === 0) {
            throw new BusinessError('User not found. Please log in again.', 400);
        }

        // Aturan duplikat merujuk ke tabel baru: production_lot_upload_logs
        const [existingLogs] = await connection.query(
            'SELECT id FROM production_lot_upload_logs WHERE file_hash = ? OR process_timestamp = ? LIMIT 1',
            [fileHash, processTimestamp]
        );
        if (existingLogs.length > 0) {
            throw new BusinessError('This production lot allocation file has already been committed previously.', 409);
        }

        const { existingHashes, openPoDetails, allProducts, context } = await loadProductionLotContext(
            connection,
            rawRows,
            { forUpdate: true }
        );

        const calculation = calculateLotFifoAllocation(rawRows, existingHashes, openPoDetails, allProducts, context);

        if (computeAllocationFingerprint(calculation) !== clientFingerprint) {
            throw new BusinessError(
                'The allocation result has changed since the preview was generated (for example, a PO was updated). Please upload the file again to review the latest preview.',
                409
            );
        }

        if (calculation.previewResults.length === 0) {
            throw new BusinessError('There is no valid lot allocation to save.', 400);
        }

        const result = await commitProductionAllocationTransaction(connection, {
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
            message: 'Production lot allocation successfully saved to database.',
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

        const finalError = error && error.code === 'ER_DUP_ENTRY' ? translateDuplicateEntry(error) : error;

        return sendControllerError(res, finalError, {
            label: 'Commit Production Lot Allocation Error',
            fallbackMessage: 'Failed to save production lot allocation. Please try again or contact the administrator.'
        });
    } finally {
        if (connection) {
            if (lockAcquired) {
                try {
                    await connection.query('SELECT RELEASE_LOCK(?)', [COMMIT_LOCK_NAME]);
                } catch (releaseError) {
                    console.error('Release lock failed:', releaseError);
                }
            }
            connection.release();
        }
    }
};
