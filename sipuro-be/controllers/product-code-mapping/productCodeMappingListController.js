const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { asText, parsePageParams } = require('../../helpers/queryParams');
const { listMappings } = require('../../services/product-code-mapping/productCodeMappingService');

/**
 * Daftar pemetaan kode produk (SUPERADMIN), dengan pencarian dan halaman.
 */
exports.listProductCodeMappings = async (req, res) => {
    try {
        const { page, limit, offset } = parsePageParams(req.query, { defaultLimit: 10, maxLimit: 100 });
        const result = await listMappings(sipuroDb, { search: asText(req.query.search), page, limit, offset });

        return res.status(200).json({
            success: true,
            message: 'Product code mappings fetched successfully.',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error listProductCodeMappings',
            fallbackMessage: 'Internal server error while fetching product code mappings.'
        });
    }
};
