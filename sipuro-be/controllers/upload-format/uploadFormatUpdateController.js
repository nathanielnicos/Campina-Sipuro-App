const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { runInLockedTransaction } = require('../../helpers/lockedTransaction');
const { parseActorId, assertActorExists } = require('../../helpers/actorHelper');
const { parseUpdateInput, updateFormat } = require('../../services/upload-format/uploadFormatService');

/**
 * Simpan format file upload satu scope (LOT atau DO). Pelaku dari token.
 */
exports.updateUploadFormat = async (req, res) => {
    try {
        const input = parseUpdateInput(req.params.scope, req.body);
        const userId = parseActorId(req);

        const data = await runInLockedTransaction(sipuroDb, async (connection) => {
            await assertActorExists(connection, userId);
            return updateFormat(connection, { ...input, userId });
        });

        return res.status(200).json({ success: true, message: 'Upload format successfully saved.', data });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error updateUploadFormat',
            fallbackMessage: 'Internal server error while saving the upload format.'
        });
    }
};
