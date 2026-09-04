const express = require('express');
const router = express.Router();
const poController = require('../controllers/po/poController');

// 1. Endpoint Statis / Root Path (Wajib di Atas)
router.get('/', poController.getPOList);
router.post('/', poController.createPO);
router.get('/export-excel', poController.exportPoExcel);

// 2. Endpoint Dinamis Spesifik / Sub-resource Berparameter
router.patch('/:id/cancel', poController.cancelPO);
router.put('/:id/status', poController.updatePOStatus);

// 3. Endpoint Dinamis Umum / Utama (:id)
router.get('/:id', poController.getPODetail);
router.put('/:id', poController.updatePO);

module.exports = router;
