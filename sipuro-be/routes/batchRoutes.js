const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');

router.get('/existing/:productId', batchController.getExistingBatchesByProduct);
router.post('/allocate', batchController.createBatchAllocation);

module.exports = router;
