const express = require('express');
const router = express.Router();
const { getAccessPermissions, getAccessPermissionLogs } = require('../controllers/access-permission/accessPermissionListController');
const { updateAccessPermissions } = require('../controllers/access-permission/accessPermissionUpdateController');
const { requirePermission } = require('../middleware/requirePermission');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Pengaturan izin dikunci untuk SUPERADMIN (lihat LOCKED_MENU di permissionCatalog).
router.get('/', requirePermission('ACCESS_PERMISSIONS', 'read'), getAccessPermissions);
router.put('/', requirePermission('ACCESS_PERMISSIONS', 'update'), updateAccessPermissions);
router.get('/logs', requirePermission('ACCESS_PERMISSIONS', 'read'), getAccessPermissionLogs);

module.exports = router;
