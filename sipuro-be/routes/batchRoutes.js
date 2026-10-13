const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch/batchController');
const { handleExcelUpload } = require('../middleware/excelUpload');

// 1. RUTE STATIS (GET)
router.get('/export-batch-excel', batchController.exportBatchMappingExcel);
router.get('/outstanding-summary', batchController.getOutstandingSummary);
router.get('/batch-mapping', batchController.getAllocatedBatchMapping);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/allocation-logs/:allocationId', batchController.getAllocationHistory);

// 3. RUTE ACTION / MUTASI (POST)
router.post('/production/preview', handleExcelUpload, batchController.previewExcelUpload);
router.post('/production/commit', handleExcelUpload, batchController.commitExcelAllocation);
router.patch('/allocation/:allocationId/status', batchController.updateAllocationStatus);
router.patch('/allocation/:allocationId/qty', batchController.updateAllocationQty);

module.exports = router;
