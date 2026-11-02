const { sipuroDb } = require('../../config/db');
const { sendControllerError } = require('../../helpers/businessError');
const { runInLockedTransaction } = require('../../helpers/lockedTransaction');
const { parseActorId, assertActorExists } = require('../../helpers/actorHelper');
const { parseChanges, loadMatrixView, applyChanges } = require('../../services/access-permission/accessPermissionService');
const { invalidatePermissionCache } = require('../../services/access-permission/permissionStore');

/**
 * Simpan perubahan izin (SUPERADMIN). Pelaku dari token; perubahan tercatat di riwayat.
 * Body: { changes: [{ group, menu, action, allowed }] }
 */
exports.updateAccessPermissions = async (req, res) => {
    try {
        const changes = parseChanges(req.body);
        const userId = parseActorId(req);

        const { changedCount } = await runInLockedTransaction(sipuroDb, async (connection) => {
            await assertActorExists(connection, userId);
            return applyChanges(connection, { changes, userId });
        });

        // Berlaku segera di instance ini; instance lain mengikuti setelah masa berlaku cache
        invalidatePermissionCache();

        const data = await loadMatrixView(sipuroDb);
        return res.status(200).json({
            success: true,
            message: changedCount > 0 ? `${changedCount} permission(s) updated.` : 'No permission changes were needed.',
            changedCount,
            data
        });
    } catch (error) {
        return sendControllerError(res, error, {
            label: 'Error updateAccessPermissions',
            fallbackMessage: 'Internal server error while updating access permissions.'
        });
    }
};
