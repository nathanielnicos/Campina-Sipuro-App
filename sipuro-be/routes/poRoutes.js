const express = require('express');
const router = express.Router();
const poController = require('../controllers/po/poController');

// 1. Endpoint Statis (Wajib ditaruh di atas endpoint berparameter :id)
router.get('/', poController.getPOList);
router.post('/', poController.createPO);
router.get('/export-excel', poController.exportPoExcel);

// 2. Endpoint Dinamis / Berparameter (:id)
router.get('/:id', poController.getPODetail);
router.put('/:id', poController.updatePO);
router.patch('/:id/cancel', poController.cancelPO);
router.put('/:id/status', poController.updatePOStatus);

module.exports = router;
