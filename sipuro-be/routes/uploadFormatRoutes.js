const express = require('express');
const router = express.Router();
const { listUploadFormats } = require('../controllers/upload-format/uploadFormatListController');
const { updateUploadFormat } = require('../controllers/upload-format/uploadFormatUpdateController');
const { requirePermission } = require('../middleware/requirePermission');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Format file upload menentukan kolom Excel mana yang dibaca: izin menu SETTINGS (diatur di Access Permission).
// Tidak ada hapus: format hanya diubah (riwayat perubahan dicatat).

router.get('/', requirePermission('SETTINGS', 'read'), listUploadFormats);
router.put('/:scope', requirePermission('SETTINGS', 'update'), updateUploadFormat);

module.exports = router;
