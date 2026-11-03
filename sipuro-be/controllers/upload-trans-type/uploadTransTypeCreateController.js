const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { runInLockedTransaction } = require('../../helpers/lockedTransaction');
const { parseActorId, assertActorExists } = require('../../helpers/actorHelper');
const { parseCreateBody, createTransType } = require('../../services/upload-trans-type/uploadTransTypeService');

/**
 * Tambah jenis transaksi upload lot. Pelaku dari token.
 */
exports.createUploadTransType = async (req, res) => {
    try {
        const input = parseCreateBody(req.body);
        const userId = parseActorId(req);

        const data = await runInLockedTransaction(sipuroDb, async (connection) => {
            await assertActorExists(connection, userId);
            return createTransType(connection, { ...input, userId });
        });

        return res.status(201).json({ success: true, message: 'Trans type successfully added.', data });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error createUploadTransType',
            fallbackMessage: 'Internal server error while adding the trans type.'
        });
    }
};
