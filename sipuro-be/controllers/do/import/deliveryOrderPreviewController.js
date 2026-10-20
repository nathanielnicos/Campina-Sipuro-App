const { sipuroDb: db } = require('../../../config/db');
const { parseDeliveryOrderExcel } = require('../../../helpers/upload-do/deliveryOrderParserHelper');
const { loadDeliveryOrderContext } = require('../../../helpers/upload-do/deliveryOrderDataLoader');
const { calculateDeliveryOrderFifo } = require('../../../helpers/upload-do/deliveryOrderCalculatorHelper');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');
const crypto = require('crypto');

// Menghasilkan fingerprint hasil alokasi DO agar sinkron dengan saat commit
const computeDoFingerprint = (calculation) => {
    const payload = {
        validRows: calculation.categorizedDetails.newRows.map((r) => r.rowHash),
        allocatedGroups: calculation.allocatedDoGroups.map((g) => ({
            shipmentNum: g.group.shipmentNum,
            itemCode: g.group.itemCode,
            lotNumber: g.group.lotNumber,
            totalQty: g.group.totalQty,
            allocations: g.doAllocations.map((a) => [a.poLotAllocationId, a.qtyPcs])
        }))
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

/**
 * Preview Upload Excel Delivery Order (Mapping DO ke Lot PO)
 */
exports.previewDeliveryOrderUpload = async (req, res) => {
    try {
        if (!req.file) {
            throw new BusinessError('Excel file is required.', 400);
        }

        const { processTimestamp, fileHash, rawRows } = parseDeliveryOrderExcel(req.file.buffer);

        // Cek apakah file atau timestamp K1 sudah pernah diupload ke DO
        const [existingLogs] = await db.query(
            'SELECT id, uploaded_at FROM delivery_order_upload_logs WHERE process_timestamp = ? OR file_hash = ?',
            [processTimestamp, fileHash]
        );
        const isAlreadyUploaded = existingLogs && existingLogs.length > 0;

        // Muat alokasi Lot PO yang siap dikirim
        const { allProducts, existingHashes, openLotAllocations } = await loadDeliveryOrderContext(db, rawRows);

        // Hitung alokasi FIFO DO
        const calculationResult = calculateDeliveryOrderFifo(
            rawRows,
            existingHashes,
            openLotAllocations,
            allProducts
        );

        return res.json({
            success: true,
            data: {
                processTimestamp,
                fileHash,
                fileName: req.file.originalname,
                allocationMode: 'FIFO_DO_PO_LOT',
                isReupload: isAlreadyUploaded,
                warningMessage: isAlreadyUploaded ? 'This DO file or process timestamp has been uploaded previously.' : null,
                fingerprint: computeDoFingerprint(calculationResult),
                ...calculationResult
            }
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Preview Delivery Order Upload Error',
            fallbackMessage: 'Failed to process the DO Excel file. Please try again or contact the administrator.'
        });
    }
};

module.exports.computeDoFingerprint = computeDoFingerprint;
