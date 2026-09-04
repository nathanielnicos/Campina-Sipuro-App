const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch/batchController');

// 1. RUTE STATIS (GET)
router.get('/export-batch-excel', batchController.exportBatchMappingExcel);
router.get('/unassigned-summary', batchController.getUnassignedSummary);
router.get('/batch-mapping', batchController.getAllocatedBatchMapping);
router.get('/unallocated', batchController.getUnallocatedStocks);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/batches-by-sku/:id_product', batchController.getBatchesBySku);
router.get('/open-allocations/:productId', batchController.getOpenAllocationsByProduct);

// 3. RUTE ACTION / MUTASI (POST)
router.post('/assign-batch-bulk', batchController.assignBatchBulk);
router.post('/reallocate', batchController.reallocateUnallocatedStock);
router.patch('/allocation/:allocationId/status', batchController.updateAllocationStatus);

module.exports = router;
