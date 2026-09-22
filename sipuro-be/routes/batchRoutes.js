const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch/batchController');

// 1. RUTE STATIS (GET)
router.get('/export-batch-excel', batchController.exportBatchMappingExcel);
router.get('/outstanding-summary', batchController.getOutstandingSummary);
router.get('/batch-mapping', batchController.getAllocatedBatchMapping);
router.get('/unallocated', batchController.getUnallocatedStocks);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/open-allocations/:productId', batchController.getOpenAllocationsByProduct);

// 3. RUTE ACTION / MUTASI (POST)
router.post('/reallocate', batchController.reallocateUnallocatedStock);
router.patch('/allocation/:allocationId/status', batchController.updateAllocationStatus);
router.patch('/:batchId/rename', batchController.updateBatchNumber);

module.exports = router;
