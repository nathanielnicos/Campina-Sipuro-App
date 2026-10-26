const express = require('express');
const router = express.Router();
const productionLotController = require('../controllers/production-lot/productionLotController');
const { handleExcelUpload } = require('../middleware/excelUpload');
const { requireAccess } = require('../middleware/auth');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Di sini hanya pembatasan per kelompok pengguna: seluruh rute Production Lot (mapping dan
// upload) hanya untuk PPIC, sama seperti modul Batch yang digantikannya.
// Pembatasan dipasang SEBELUM middleware upload, sehingga file dari pengguna yang tidak berhak
// tidak pernah diproses.
const ppicOnly = requireAccess('PPIC');

// 1. RUTE STATIS (GET)
router.get('/mapping', ppicOnly, productionLotController.getAllocatedLotMapping);

// 2. RUTE DINAMIS (GET dengan Parameter)

// 3. RUTE ACTION / MUTASI (POST)
router.post('/upload/preview', ppicOnly, handleExcelUpload, productionLotController.previewExcelUpload);
router.post('/upload/commit', ppicOnly, handleExcelUpload, productionLotController.commitExcelAllocation);

module.exports = router;
