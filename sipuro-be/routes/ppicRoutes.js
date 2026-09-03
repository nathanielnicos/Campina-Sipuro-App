const express = require('express');
const router = express.Router();
const multer = require('multer');
const ppicController = require('../controllers/ppic/ppicController');

// Endpoints Rekap & Alokasi Batch
router.get('/unassigned-summary', ppicController.getUnassignedSummary);
router.get('/batches-by-sku/:id_product', ppicController.getBatchesBySku);
router.post('/assign-batch-bulk', ppicController.assignBatchBulk);

// Endpoint Monitoring Batch
router.get('/batch-mapping', ppicController.getAllocatedBatchMapping);

// Endpoint Export Excel
router.get('/export-batch-excel', ppicController.exportBatchMappingExcel);

module.exports = router;
