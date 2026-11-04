const express = require('express');
const router = express.Router();
const deliveryOrderListController = require('../controllers/delivery-order/list/deliveryOrderListController');
const deliveryOrderExportController = require('../controllers/delivery-order/export/deliveryOrderExportController');
const deliveryOrderEstimatedPoController = require('../controllers/delivery-order/list/deliveryOrderEstimatedPoController');
const deliveryOrderUploadPreviewController = require('../controllers/delivery-order/import/deliveryOrderUploadPreviewController');
const deliveryOrderUploadCommitController = require('../controllers/delivery-order/import/deliveryOrderUploadCommitController');
const { handleExcelUpload } = require('../middleware/excelUpload');
const { requirePermission } = require('../middleware/requirePermission');

// Login sudah diwajibkan secara global di server.js (requireAuth). Izin per kelompok diatur Superadmin
// (menu Access Permission); awalnya: lihat DO / retur untuk PPIC, LOGISTIC, FINANCE dan upload untuk LOGISTIC saja, export untuk PPIC, LOGISTIC, FINANCE.
// Pembatasan dipasang SEBELUM middleware upload, sehingga file dari pengguna yang tidak berhak tidak pernah diproses.
const canView = requirePermission('DO', 'read');
const canUpload = requirePermission('DO', 'upload');
const canExport = requirePermission('DO', 'export');

// 1. RUTE STATIS (GET)
router.get('/mapping', canView, deliveryOrderListController.getDeliveryOrderMapping);
router.get('/estimated-po', canView, deliveryOrderEstimatedPoController.getEstimatedPo);
router.get('/export', canExport, deliveryOrderExportController.exportDeliveryOrderExcel);

// 2. RUTE DINAMIS (GET dengan Parameter)

// 3. RUTE ACTION / MUTASI (POST)
router.post('/upload/preview', canUpload, handleExcelUpload, deliveryOrderUploadPreviewController.previewDeliveryOrderUpload);
router.post('/upload/commit', canUpload, handleExcelUpload, deliveryOrderUploadCommitController.commitDeliveryOrderUpload);

module.exports = router;
