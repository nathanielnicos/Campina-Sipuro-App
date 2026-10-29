const { sipuroDb } = require('../../../config/db');
const { sendControllerError } = require('../../../helpers/businessError');
const { runInLockedTransaction } = require('../../../helpers/lockedTransaction');
const { parseActorId, assertActorExists } = require('../../../helpers/actorHelper');
const {
    formatThousand,
    parseAllocationId,
    parseReason,
    parseNewQty,
    adjustAllocationQty
} = require('../../../services/production-lot/lotAllocationAdjustService');

/**
 * Ubah qty alokasi (tambah atau kurang). Pelaku dari token; alasan wajib.
 */
exports.updateAllocationQty = async (req, res) => {
    try {
        const allocationId = parseAllocationId(req.params.allocationId);
        const body = req.body || {};
        const newQty = parseNewQty(body.newAllocatedQty);
        const reason = parseReason(body.reason);
        const userId = parseActorId(req);

        const data = await runInLockedTransaction(sipuroDb, async (connection) => {
            await assertActorExists(connection, userId);
            return adjustAllocationQty(connection, { allocationId, newQty, reason, userId });
        });

        return res.status(200).json({
            success: true,
            message: `Allocated quantity successfully updated from ${formatThousand(data.oldAllocatedQty)} to ${formatThousand(data.newAllocatedQty)}.`,
            data
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error updateAllocationQty',
            fallbackMessage: 'Internal server error while updating allocated quantity.'
        });
    }
};
