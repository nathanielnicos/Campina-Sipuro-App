const { sipuroDb } = require('../../../config/db');
const { BusinessError, sendControllerError } = require('../../../helpers/businessError');
const { runInLockedTransaction } = require('../../../helpers/lockedTransaction');
const { parseActorId, assertActorExists } = require('../../../helpers/actorHelper');
const {
    parseAllocationId,
    parseReason,
    forceCloseAllocation
} = require('../../../services/production-lot/lotAllocationAdjustService');

/**
 * Ubah status alokasi (hanya FORCE_CLOSE). Pelaku dari token; alasan wajib.
 */
exports.updateAllocationStatus = async (req, res) => {
    try {
        const allocationId = parseAllocationId(req.params.allocationId);
        const body = req.body || {};

        if (body.action !== 'FORCE_CLOSE') {
            throw new BusinessError('Invalid action type. Only "FORCE_CLOSE" action is supported.', 400);
        }
        const reason = parseReason(body.reason);
        const userId = parseActorId(req);

        const data = await runInLockedTransaction(sipuroDb, async (connection) => {
            await assertActorExists(connection, userId);
            return forceCloseAllocation(connection, { allocationId, reason, userId });
        });

        return res.status(200).json({
            success: true,
            message: `Allocation status successfully updated to ${data.status}.`
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error updateAllocationStatus',
            fallbackMessage: 'Internal server error while updating allocation status.'
        });
    }
};
