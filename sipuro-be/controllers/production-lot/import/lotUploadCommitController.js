const { sipuroDb: db } = require('../../../config/db');
const { parseProductionExcel } = require('../../../services/production-lot/lotUploadParser');
const { calculateLotFifoAllocation, computeAllocationFingerprint } = require('../../../services/production-lot/lotAllocationCalculator');
const { loadProductionLotContext } = require('../../../services/production-lot/lotContextLoader');
const { commitProductionAllocationTransaction } = require('../../../services/production-lot/lotCommitService');
const { runInLockedTransaction } = require('../../../services/production-lot/lotLockedTransaction');
const { parseActorId, assertActorExists } = require('../../../services/production-lot/lotActor');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');

const BUSY_MESSAGE = 'Another production lot upload is being saved. Please try again in a moment.';

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

        const { processTimestamp, fileHash, rawRows } = parseProductionExcel(req.file.buffer);

        // Commit upload berjalan satu per satu (lintas instance serverless)
        const result = await runInLockedTransaction(db, async (connection) => {
            await assertActorExists(connection, userId);

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

            return commitProductionAllocationTransaction(connection, {
                fileName: req.file.originalname,
                processTimestamp,
                fileHash,
                userId,
                calculation
            });
        }, { busyMessage: BUSY_MESSAGE });

        return res.json({
            success: true,
            message: 'Production lot allocation successfully saved to database.',
            data: result
        });
    } catch (error) {
        const finalError = error && error.code === 'ER_DUP_ENTRY' ? translateDuplicateEntry(error) : error;

        return sendControllerError(res, finalError, {
            label: 'Commit Production Lot Allocation Error',
            fallbackMessage: 'Failed to save production lot allocation. Please try again or contact the administrator.'
        });
    }
};
