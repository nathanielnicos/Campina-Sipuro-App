const express = require('express');
const router = express.Router();
const poController = require('../controllers/po/poController');

router.get('/', poController.getPOList);
router.post('/', poController.createPO);
router.get('/export-excel', poController.exportPoExcel);
router.get('/:id', poController.getPODetail);
router.put('/:id', poController.updatePO);
router.patch('/:id/cancel', poController.cancelPO);
router.put('/:id/status', poController.updatePOStatus);

module.exports = router;
