const express = require('express');
const router = express.Router();
const documentFlowController = require('../controllers/documentFlow/documentFlowController');

router.get('/do', documentFlowController.getDeliveryOrders);
router.get('/si', documentFlowController.getSalesInvoices);

router.post('/preview', documentFlowController.previewImport);
router.post('/commit', documentFlowController.commitImport);

module.exports = router;
