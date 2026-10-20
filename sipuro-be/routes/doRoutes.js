const express = require('express');
const router = express.Router();
const deliveryOrderController = require('../controllers/do/deliveryOrderController');
const { handleExcelUpload } = require('../middleware/excelUpload');

// 1. RUTE STATIS (GET)
router.get('/list', deliveryOrderController.getDeliveryOrderMapping);

// 2. RUTE DINAMIS (GET dengan Parameter)

// 3. RUTE ACTION / MUTASI (POST)
router.post('/upload/preview', handleExcelUpload, deliveryOrderController.previewDeliveryOrderUpload);
router.post('/upload/commit', handleExcelUpload, deliveryOrderController.commitDeliveryOrderAllocation);

module.exports = router;
