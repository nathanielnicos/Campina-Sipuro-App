const express = require('express');
const router = express.Router();
const { listUploadTransTypes } = require('../controllers/upload-trans-type/uploadTransTypeListController');
const { createUploadTransType } = require('../controllers/upload-trans-type/uploadTransTypeCreateController');
const { updateUploadTransType } = require('../controllers/upload-trans-type/uploadTransTypeUpdateController');
const { requirePermission } = require('../middleware/requirePermission');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Daftar jenis transaksi menentukan baris Excel mana yang memengaruhi alokasi: izin menu SETTINGS (diatur di Access Permission).
// Tidak ada hapus: jenis diaktifkan/dinonaktifkan.

router.get('/', requirePermission('SETTINGS', 'read'), listUploadTransTypes);
router.post('/', requirePermission('SETTINGS', 'update'), createUploadTransType);
router.patch('/:transTypeId', requirePermission('SETTINGS', 'update'), updateUploadTransType);

module.exports = router;
