const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { runInLockedTransaction } = require('../../helpers/lockedTransaction');
const { parseActorId, assertActorExists } = require('../../helpers/actorHelper');
const { parseProductId, createMapping } = require('../../services/product-code-mapping/productCodeMappingService');

/**
 * Tambah pemetaan kode produk lama -> baru (SUPERADMIN). Pelaku dari token.
 */
exports.createProductCodeMapping = async (req, res) => {
    try {
        const body = req.body || {};
        const idProductOld = parseProductId(body.idProductOld, 'old product');
        const idProductNew = parseProductId(body.idProductNew, 'new product');
        const userId = parseActorId(req);

        const data = await runInLockedTransaction(sipuroDb, async (connection) => {
            await assertActorExists(connection, userId);
            return createMapping(connection, { idProductOld, idProductNew, userId });
        });

        return res.status(201).json({
            success: true,
            message: 'Product code mapping successfully created.',
            data
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error createProductCodeMapping',
            fallbackMessage: 'Internal server error while creating product code mapping.'
        });
    }
};
