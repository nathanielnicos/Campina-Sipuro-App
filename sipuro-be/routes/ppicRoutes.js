const express = require('express');
const router = express.Router();
const multer = require('multer');
const ppicController = require('../controllers/ppic/ppicController');

const upload = multer({ storage: multer.memoryStorage() });

// Endpoint Statistik Dasbor PPIC
router.get('/dashboard-stats', ppicController.getDashboardStats);

// Endpoints Rekap & Alokasi Batch
router.get('/unassigned-summary', ppicController.getUnassignedSummary);
router.get('/batches-by-sku/:id_product', ppicController.getBatchesBySku);
router.post('/assign-batch-bulk', ppicController.assignBatchBulk);

// Endpoint Monitoring Batch
router.get('/batch-mapping', ppicController.getAllocatedBatchMapping);

// Upload Excel -> Preview
router.post('/upload/preview', upload.single('file'), ppicController.previewProduction);

// Konfirmasi Simpan Hasil Produksi ke DB
router.post('/upload/commit', ppicController.confirmProduction);

// Endpoint Export Excel
router.get('/export-batch-excel', ppicController.exportBatchMappingExcel);

module.exports = router;
