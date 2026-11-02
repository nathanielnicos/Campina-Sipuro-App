const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { parsePageParams } = require('../../helpers/queryParams');
const { loadMatrixView, listLogs } = require('../../services/access-permission/accessPermissionService');

/** Matriks izin (menu x aksi per kelompok), dibaca langsung dari database. */
exports.getAccessPermissions = async (req, res) => {
    try {
        const data = await loadMatrixView(sipuroDb);
        return res.status(200).json({ success: true, message: 'Access permissions fetched successfully.', data });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error getAccessPermissions',
            fallbackMessage: 'Internal server error while fetching access permissions.'
        });
    }
};

/** Riwayat perubahan izin, terbaru dahulu. */
exports.getAccessPermissionLogs = async (req, res) => {
    try {
        const { page, limit, offset } = parsePageParams(req.query, { defaultLimit: 20, maxLimit: 100 });
        const result = await listLogs(sipuroDb, { page, limit, offset });
        return res.status(200).json({
            success: true,
            message: 'Access permission history fetched successfully.',
            data: result.data,
            pagination: result.pagination
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error getAccessPermissionLogs',
            fallbackMessage: 'Internal server error while fetching access permission history.'
        });
    }
};
