const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { listFormats } = require('../../services/upload-format/uploadFormatService');

/**
 * Format file upload (Production Lot dan Delivery Order): kolom tiap field, baris data pertama, sel process timestamp.
 */
exports.listUploadFormats = async (req, res) => {
    try {
        const data = await listFormats(sipuroDb);
        return res.status(200).json({ success: true, message: 'Upload formats fetched successfully.', data });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error listUploadFormats',
            fallbackMessage: 'Internal server error while fetching upload formats.'
        });
    }
};
