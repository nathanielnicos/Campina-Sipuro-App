const express = require('express');
const router = express.Router();
const { getMyPermissions } = require('../controllers/access-permission/myPermissionsController');

// Izin milik pengguna yang sedang login; semua pengguna login boleh membacanya (login diwajibkan di server.js).
router.get('/me', getMyPermissions);

module.exports = router;
