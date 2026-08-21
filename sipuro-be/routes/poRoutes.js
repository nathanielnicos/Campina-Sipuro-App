const express = require('express');
const router = express.Router();
const poController = require('../controllers/poController');

router.get('/', poController.getPOList);
router.post('/', poController.createPO);
router.get('/:id', poController.getPODetail);
router.put('/:id', poController.updatePO);
router.patch('/:id/cancel', poController.cancelPO);
router.put('/:id/status', poController.updatePOStatus);

module.exports = router;
