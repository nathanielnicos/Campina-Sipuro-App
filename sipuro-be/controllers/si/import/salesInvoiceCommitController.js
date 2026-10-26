const { sipuroDb: db } = require('../../../config/db');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');
const { parseSalesInvoiceExcel } = require('../../../helpers/upload-si/salesInvoiceParserHelper');
const { loadSalesInvoiceContext } = require('../../../helpers/upload-si/salesInvoiceDataLoader');
const { calculateSalesInvoiceMatching, computeSiFingerprint } = require('../../../helpers/upload-si/salesInvoiceCalculatorHelper');
const { commitSalesInvoiceTransaction } = require('../../../helpers/upload-si/salesInvoiceCommitHelper');
const { COMMIT_LOCK_NAME, COMMIT_LOCK_TIMEOUT_SECONDS } = require('../../../helpers/upload-si/salesInvoiceConfig');

exports.commitSalesInvoiceAllocation = async (req, res) => {
    let connection = null;
    let lockAcquired = false;
    let inTransaction = false;

    try {
        if (!req.file) throw new BusinessError('Excel file is required.', 400);

        const userId = Number.parseInt(req.user && req.user.id, 10);
        if (!Number.isInteger(userId) || userId <= 0) {
            throw new BusinessError('A valid user is required. Please log in again.', 400);
        }

        const clientFingerprint = String(req.body.fingerprint || '').trim();
        if (!clientFingerprint) throw new BusinessError('Preview fingerprint is missing.', 400);

        const { fileHash, processTimestamp, rows } = parseSalesInvoiceExcel(req.file.buffer);

        connection = await db.getConnection();

        const [[lockRow]] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [
            COMMIT_LOCK_NAME,
            COMMIT_LOCK_TIMEOUT_SECONDS
        ]);
        if (!lockRow || Number(lockRow.acquired) !== 1) {
            throw new BusinessError('Another Sales Invoice upload is being processed. Please wait.', 409);
        }
        lockAcquired = true;

        await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await connection.beginTransaction();
        inTransaction = true;

        const [existingLogs] = await connection.query(
            'SELECT id FROM document_import_logs WHERE file_hash = ? OR process_timestamp = ? LIMIT 1',
            [fileHash, processTimestamp]
        );
        if (existingLogs.length > 0) {
            throw new BusinessError('This file has already been committed previously.', 409);
        }

        const context = await loadSalesInvoiceContext(connection, rows, { forUpdate: true });
        const calculation = calculateSalesInvoiceMatching({ rows, ...context });

        if (computeSiFingerprint(calculation, fileHash) !== clientFingerprint) {
            throw new BusinessError('Data has changed since preview. Please upload again.', 409);
        }

        if (!calculation.canSave) {
            throw new BusinessError('No valid Sales Invoices to save.', 400);
        }

        const result = await commitSalesInvoiceTransaction(connection, {
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
            message: `Successfully saved ${result.savedSalesInvoiceCount} Sales Invoice(s).`,
            data: result
        });
    } catch (error) {
        if (connection && inTransaction) {
            try { await connection.rollback(); } catch (e) { console.error('Rollback error:', e); }
        }
        return sendControllerError(res, error, {
            label: 'Commit Sales Invoice Error',
            fallbackMessage: 'Failed to commit Sales Invoice.'
        });
    } finally {
        if (connection) {
            if (lockAcquired) {
                try { await connection.query('SELECT RELEASE_LOCK(?)', [COMMIT_LOCK_NAME]); } catch (e) {}
            }
            connection.release();
        }
    }
};
