const { sipuroDb } = require('../../../config/db');
const { getAllocationLogs } = require('../../../services/production-lot/lotAllocationLog');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');
const { parsePageParams } = require('../../../helpers/queryParams');

const MAX_LOG_LIMIT = 100;

/**
 * Riwayat perubahan satu alokasi (po_lot_allocation_logs).
 */
exports.getAllocationHistory = async (req, res) => {
    try {
        const allocationId = Number(req.params.allocationId);
        if (!Number.isInteger(allocationId) || allocationId <= 0) {
            throw new BusinessError('A valid Allocation ID is required.', 400);
        }

        const { page, limit } = parsePageParams(req.query, { defaultLimit: 10, maxLimit: MAX_LOG_LIMIT });
        const result = await getAllocationLogs(sipuroDb, allocationId, page, limit);

        return res.status(200).json({
            success: true,
            message: 'Allocation logs fetched successfully.',
            data: result.logs,
            pagination: result.pagination
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error getAllocationHistory',
            fallbackMessage: 'Internal server error while fetching allocation history logs.'
        });
    }
};
