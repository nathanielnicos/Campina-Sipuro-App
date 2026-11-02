const express = require('express');
const router = express.Router();
const siController = require('../controllers/si/salesInvoiceController');
const { handleExcelUpload } = require('../middleware/excelUpload');
const { requirePermission } = require('../middleware/requirePermission');

// Izin diatur Superadmin (menu Access Permission); awalnya LOGISTIC, FINANCE, dan SUPERADMIN.
const canView = requirePermission('SI', 'read');
const canUpload = requirePermission('SI', 'upload');

// GET
router.get('/mapping', canView, siController.getSalesInvoiceMapping);

// POST
router.post('/upload/preview', canUpload, handleExcelUpload, siController.previewSalesInvoiceUpload);
router.post('/upload/commit', canUpload, handleExcelUpload, siController.commitSalesInvoiceAllocation);

module.exports = router;
