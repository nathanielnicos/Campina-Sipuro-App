const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch/batchController');

router.get('/existing/:productId', batchController.getExistingBatchesByProduct);
router.post('/allocate', batchController.createBatchAllocation);

router.get('/open-allocations/:productId', batchController.getOpenAllocationsByProduct);
router.post('/reallocate', batchController.reallocateUnallocatedStock);

module.exports = router;
