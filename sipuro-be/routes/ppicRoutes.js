const express = require('express');
const router = express.Router();
const multer = require('multer');
const ppicController = require('../controllers/batch/ppicController');

router.get('/export-batch-excel', ppicController.exportBatchMappingExcel);
router.get('/unassigned-summary', ppicController.getUnassignedSummary);
router.get('/batches-by-sku/:id_product', ppicController.getBatchesBySku);
router.post('/assign-batch-bulk', ppicController.assignBatchBulk);
router.get('/batch-mapping', ppicController.getAllocatedBatchMapping);
router.get('/unallocated', ppicController.getUnallocatedStocks);
router.post('/reallocate', ppicController.reallocateUnallocatedStock);

module.exports = router;
