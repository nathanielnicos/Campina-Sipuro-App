const express = require('express');
const router = express.Router();
const productionLotController = require('../controllers/production-lot/productionLotController');
const { handleExcelUpload } = require('../middleware/excelUpload');

// 1. RUTE STATIS (GET)

// 2. RUTE DINAMIS (GET dengan Parameter)

// 3. RUTE ACTION / MUTASI (POST)
router.post('/upload/preview', handleExcelUpload, productionLotController.previewExcelUpload);

module.exports = router;