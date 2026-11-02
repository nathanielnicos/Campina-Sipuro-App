const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { groupOf, permissionsOf } = require('../../services/access-permission/permissionStore');

/** Izin pengguna yang sedang login (menu dan aksi), dipakai FE untuk menu dan tombol. */
exports.getMyPermissions = async (req, res) => {
    try {
        const permissions = await permissionsOf(sipuroDb, req.user);
        return res.status(200).json({
            success: true,
            message: 'Permissions fetched successfully.',
            data: { group: groupOf(req.user), permissions }
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error getMyPermissions',
            fallbackMessage: 'Internal server error while fetching permissions.'
        });
    }
};
