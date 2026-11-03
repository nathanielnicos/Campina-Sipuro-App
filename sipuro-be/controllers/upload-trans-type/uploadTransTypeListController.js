const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { listTransTypes } = require('../../services/upload-trans-type/uploadTransTypeService');

/**
 * Daftar jenis transaksi upload (lot dan DO) beserta penanda sudah pernah dipakai.
 */
exports.listUploadTransTypes = async (req, res) => {
    try {
        const data = await listTransTypes(sipuroDb);
        return res.status(200).json({ success: true, message: 'Trans types fetched successfully.', data });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error listUploadTransTypes',
            fallbackMessage: 'Internal server error while fetching trans types.'
        });
    }
};
