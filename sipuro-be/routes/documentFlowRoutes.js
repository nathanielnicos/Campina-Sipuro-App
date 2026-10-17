const express = require('express');
const router = express.Router();
const documentFlowController = require('../controllers/documentFlow/documentFlowController');
const { handleExcelUpload } = require('../middleware/excelUpload');
const { requireAccess } = require('../middleware/auth');

// Document Flow: LOGISTIC, FINANCE, dan SUPERADMIN
router.use(requireAccess('LOGISTIC', 'FINANCE', 'SUPERADMIN'));

router.get('/do', documentFlowController.getDeliveryOrders);
router.get('/si', documentFlowController.getSalesInvoices);

router.post('/preview', handleExcelUpload, documentFlowController.previewImport);
router.post('/commit', handleExcelUpload, documentFlowController.commitImport);

module.exports = router;
