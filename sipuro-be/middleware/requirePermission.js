'use strict';

/**
 * Pembatas akses berdasarkan matriks izin (menu x aksi) yang diatur Superadmin.
 * Contoh: router.post('/upload/commit', requirePermission('DO', 'upload'), ...)
 * Harus dipasang setelah requireAuth. Menu/aksi yang tidak ada di katalog gagal saat route didaftarkan.
 */

const { sipuroDb } = require('../config/db');
const { isValidMenuAction } = require('../services/access-permission/permissionCatalog');
const { isAllowed } = require('../services/access-permission/permissionStore');

const requirePermission = (menu, action) => {
    if (!isValidMenuAction(menu, action)) {
        throw new Error(`requirePermission: unknown menu/action "${menu}"/"${action}".`);
    }

    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required. Please log in.' });
        }
        try {
            if (await isAllowed(sipuroDb, req.user, menu, action)) return next();
            return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
        } catch (error) {
            console.error('Error in requirePermission:', error);
            return res.status(500).json({ success: false, message: 'Failed to verify permission.' });
        }
    };
};

module.exports = { requirePermission };
