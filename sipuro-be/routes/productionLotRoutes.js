const express = require('express');
const router = express.Router();
const productionLotController = require('../controllers/production-lot/productionLotController');
const { handleExcelUpload } = require('../middleware/excelUpload');

// 1. RUTE STATIS (GET)
router.get('/mapping', productionLotController.getAllocatedLotMapping);

// 2. RUTE DINAMIS (GET dengan Parameter)

// 3. RUTE ACTION / MUTASI (POST)
router.post('/upload/preview', handleExcelUpload, productionLotController.previewExcelUpload);
router.post('/upload/commit', handleExcelUpload, productionLotController.commitExcelAllocation);

module.exports = router;
