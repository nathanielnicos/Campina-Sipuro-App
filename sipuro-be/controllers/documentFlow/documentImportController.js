const { sipuroDb: db } = require('../../config/db');
const { BusinessError, sendControllerError } = require('../../helpers/businessError');
const { parseDocumentFlowExcel } = require('../../helpers/upload-document-flow/excelParserHelper');
const { loadDocumentFlowContext } = require('../../helpers/upload-document-flow/documentFlowDataLoader');
const {
    calculateDocumentFlow,
    computeDocumentFlowFingerprint
} = require('../../helpers/upload-document-flow/documentFlowCalculatorHelper');
const { commitDocumentFlowTransaction } = require('../../helpers/upload-document-flow/documentFlowCommitHelper');
const { acquireCommitLock, releaseCommitLock } = require('../../helpers/upload-document-flow/commitLockHelper');
const { COMMIT_LOCK_NAME, COMMIT_LOCK_TIMEOUT_SECONDS } = require('../../helpers/upload-document-flow/documentFlowConfig');

const REUPLOAD_MESSAGE = 'This file (or a file with the same process timestamp) has been uploaded previously.';

const translateDatabaseError = (error) => {
    const code = error && error.code;
    const msg = String((error && (error.sqlMessage || error.message)) || '');

    if (code === 'ER_DUP_ENTRY') {
        if (msg.includes('file_hash') || msg.includes('process_timestamp')) {
            return new BusinessError('This file has already been committed previously.', 409);
        }
        return new BusinessError('Some delivery orders or invoices were saved by another process. Please upload the file again to refresh the preview.', 409);
    }
    if (code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT') {
        return new BusinessError('The data is being updated by another process. Please try again in a moment.', 409);
    }
    return error;
};

/**
 * 1. Preview. Writes nothing to the database.
 */
exports.previewImport = async (req, res) => {
    try {
        if (!req.file) {
            throw new BusinessError('Excel file is required.', 400);
        }

        const { fileHash, processTimestamp, rows } = parseDocumentFlowExcel(req.file.buffer);

        // Duplicate file rule: same hash OR same process timestamp (same as commit)
        const [existingLogs] = await db.query(
            'SELECT id FROM document_import_logs WHERE file_hash = ? OR process_timestamp = ? LIMIT 1',
            [fileHash, processTimestamp]
        );
        const isReupload = existingLogs.length > 0;

        const context = await loadDocumentFlowContext(db, rows);
        const calculation = calculateDocumentFlow({ rows, ...context });

        return res.json({
            success: true,
            data: {
                fileName: req.file.originalname,
                fileHash,
                processTimestamp,
                isReupload,
                warningMessage: isReupload ? REUPLOAD_MESSAGE : null,
                // Sent back on commit; the server rejects the save if the recalculated result differs
                fingerprint: computeDocumentFlowFingerprint(calculation, fileHash),
                summary: calculation.summary,
                canSave: calculation.canSave && !isReupload,
                previewResults: calculation.previewResults,
                duplicateRows: calculation.duplicateRows,
                unregisteredRows: calculation.unregisteredRows,
                nonInterfacedRows: calculation.nonInterfacedRows,
                rowsToFix: calculation.rowsToFix,
                warnings: calculation.warnings
            }
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Preview Document Flow Error',
            fallbackMessage: 'Failed to process the Excel file. Please try again or contact the administrator.'
        });
    }
};

/**
 * 2. Commit. The client sends the same file again plus the fingerprint (never row data).
 *    The server parses and recalculates inside a transaction (with locks) and saves only when
 *    the result is identical to the preview.
 */
exports.commitImport = async (req, res) => {
    let connection = null;
    let lockAcquired = false;
    let inTransaction = false;

    try {
        if (!req.file) {
            throw new BusinessError('Excel file is required.', 400);
        }

        const userId = Number.parseInt(req.body.userId, 10);
        if (!Number.isInteger(userId) || userId <= 0) {
            throw new BusinessError('A valid user is required. Please log in again.', 400);
        }

        const clientFingerprint = String(req.body.fingerprint || '').trim();
        if (!clientFingerprint) {
            throw new BusinessError('Preview fingerprint is missing. Please upload the file again.', 400);
        }

        const { fileHash, processTimestamp, rows } = parseDocumentFlowExcel(req.file.buffer);

        connection = await db.getConnection();

        await acquireCommitLock(connection, COMMIT_LOCK_NAME, COMMIT_LOCK_TIMEOUT_SECONDS);
        lockAcquired = true;

        // READ COMMITTED: after rows are locked, later reads always see the latest data
        await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await connection.beginTransaction();
        inTransaction = true;

        const [employeeRows] = await connection.query('SELECT id FROM employees WHERE id = ? LIMIT 1', [userId]);
        if (employeeRows.length === 0) {
            throw new BusinessError('User not found. Please log in again.', 400);
        }

        const [existingLogs] = await connection.query(
            'SELECT id FROM document_import_logs WHERE file_hash = ? OR process_timestamp = ? LIMIT 1',
            [fileHash, processTimestamp]
        );
        if (existingLogs.length > 0) {
            throw new BusinessError('This file has already been committed previously.', 409);
        }

        const context = await loadDocumentFlowContext(connection, rows, { forUpdate: true });
        const calculation = calculateDocumentFlow({ rows, ...context });

        if (computeDocumentFlowFingerprint(calculation, fileHash) !== clientFingerprint) {
            throw new BusinessError(
                'The result has changed since the preview was generated (for example, an allocation was updated). Please upload the file again to review the latest preview.',
                409
            );
        }

        if (calculation.rowsToFix.length > 0) {
            throw new BusinessError(
                `${calculation.rowsToFix.length} row(s) still need to be fixed in the Excel file. Please fix them and upload the file again.`,
                422
            );
        }
        if (calculation.previewResults.length === 0) {
            throw new BusinessError('There is no valid data to save.', 400);
        }

        const result = await commitDocumentFlowTransaction(connection, {
            fileName: req.file.originalname,
            fileHash,
            processTimestamp,
            userId,
            calculation
        });

        await connection.commit();
        inTransaction = false;

        return res.json({
            success: true,
            message: `Successfully saved ${result.savedDeliveryOrderCount} delivery order(s) and ${result.savedSalesInvoiceCount} sales invoice(s).`,
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

        return sendControllerError(res, translateDatabaseError(error), {
            label: 'Commit Document Flow Error',
            fallbackMessage: 'Failed to save the Document Flow data. Please try again or contact the administrator.'
        });
    } finally {
        if (connection) {
            if (lockAcquired) await releaseCommitLock(connection, COMMIT_LOCK_NAME);
            connection.release();
        }
    }
};
