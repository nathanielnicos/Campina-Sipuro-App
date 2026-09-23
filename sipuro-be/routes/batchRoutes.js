const express = require('express');
const router = express.Router();
const multer = require('multer');
const batchController = require('../controllers/batch/batchController');

const upload = multer({ storage: multer.memoryStorage() });

// 1. RUTE STATIS (GET)
router.get('/export-batch-excel', batchController.exportBatchMappingExcel);
router.get('/outstanding-summary', batchController.getOutstandingSummary);
router.get('/batch-mapping', batchController.getAllocatedBatchMapping);

// 2. RUTE DINAMIS (GET dengan Parameter)

// 3. RUTE ACTION / MUTASI (POST)
router.post('/production/preview', upload.single('file'), batchController.previewExcelUpload);
router.post('/production/commit', batchController.commitExcelAllocation);
router.patch('/allocation/:allocationId/status', batchController.updateAllocationStatus);
router.patch('/:batchId/rename', batchController.updateBatchNumber);

module.exports = router;
