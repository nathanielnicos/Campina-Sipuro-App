const express = require('express');
const router = express.Router();
const siController = require('../controllers/si/salesInvoiceController');
const { handleExcelUpload } = require('../middleware/excelUpload');
const { requireAccess } = require('../middleware/auth');

router.use(requireAccess('LOGISTIC', 'FINANCE', 'SUPERADMIN'));

// GET
router.get('/mapping', siController.getSalesInvoiceMapping);

// POST
router.post('/upload/preview', handleExcelUpload, siController.previewSalesInvoiceUpload);
router.post('/upload/commit', handleExcelUpload, siController.commitSalesInvoiceAllocation);

module.exports = router;
