const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { runInLockedTransaction } = require('../../services/production-lot/lotLockedTransaction');
const { parseActorId, assertActorExists } = require('../../services/production-lot/lotActor');
const { parseMappingId, deleteMapping } = require('../../services/product-code-mapping/productCodeMappingService');

/**
 * Hapus pemetaan kode produk (SUPERADMIN). Alokasi yang sudah terjadi tidak berubah.
 */
exports.deleteProductCodeMapping = async (req, res) => {
    try {
        const mappingId = parseMappingId(req.params.mappingId);
        const userId = parseActorId(req);

        await runInLockedTransaction(sipuroDb, async (connection) => {
            await assertActorExists(connection, userId);
            return deleteMapping(connection, { mappingId, userId });
        });

        return res.status(200).json({
            success: true,
            message: 'Product code mapping successfully deleted.'
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error deleteProductCodeMapping',
            fallbackMessage: 'Internal server error while deleting product code mapping.'
        });
    }
};
