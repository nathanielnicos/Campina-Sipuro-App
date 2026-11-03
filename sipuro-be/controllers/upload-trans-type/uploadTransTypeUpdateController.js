const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { runInLockedTransaction } = require('../../helpers/lockedTransaction');
const { parseActorId, assertActorExists } = require('../../helpers/actorHelper');
const { parseTypeId, parseUpdateBody, updateTransType } = require('../../services/upload-trans-type/uploadTransTypeService');

/**
 * Aktifkan/nonaktifkan jenis transaksi, atau ubah nama/arah/cara cocok selama belum pernah dipakai. Pelaku dari token.
 */
exports.updateUploadTransType = async (req, res) => {
    try {
        const id = parseTypeId(req.params.transTypeId);
        const patch = parseUpdateBody(req.body);
        const userId = parseActorId(req);

        const data = await runInLockedTransaction(sipuroDb, async (connection) => {
            await assertActorExists(connection, userId);
            return updateTransType(connection, { id, patch, userId });
        });

        return res.status(200).json({ success: true, message: 'Trans type successfully updated.', data });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error updateUploadTransType',
            fallbackMessage: 'Internal server error while updating the trans type.'
        });
    }
};
