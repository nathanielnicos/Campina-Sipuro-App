const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { runInLockedTransaction } = require('../../helpers/lockedTransaction');
const { parseActorId, assertActorExists } = require('../../helpers/actorHelper');
const { parseMappingId, parseIsActive, setMappingActive } = require('../../services/product-code-mapping/productCodeMappingService');

/**
 * Aktifkan/nonaktifkan pemetaan kode produk (SUPERADMIN). Pelaku dari token.
 * Alokasi yang sudah terjadi tidak berubah.
 */
exports.updateProductCodeMappingStatus = async (req, res) => {
    try {
        const mappingId = parseMappingId(req.params.mappingId);
        const isActive = parseIsActive((req.body || {}).isActive);
        const userId = parseActorId(req);

        const data = await runInLockedTransaction(sipuroDb, async (connection) => {
            await assertActorExists(connection, userId);
            return setMappingActive(connection, { mappingId, isActive, userId });
        });

        return res.status(200).json({
            success: true,
            message: `Product code mapping successfully ${data.is_active ? 'activated' : 'deactivated'}.`,
            data
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error updateProductCodeMappingStatus',
            fallbackMessage: 'Internal server error while updating product code mapping status.'
        });
    }
};
