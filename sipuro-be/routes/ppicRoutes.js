const express = require('express');
const router = express.Router();
const multer = require('multer');
const ppicController = require('../controllers/ppicController');

const upload = multer({ storage: multer.memoryStorage() });

// Endpoint Statistik Dasbor PPIC
router.get('/dashboard-stats', ppicController.getDashboardStats);

// Endpoints Rekap & Alokasi Batch
router.get('/unassigned-summary', ppicController.getUnassignedSummary);
router.get('/batches-by-sku/:id_product', ppicController.getBatchesBySku);
router.post('/assign-batch-bulk', ppicController.assignBatchBulk);

// Endpoint Monitoring Batch
router.get('/batch-mapping', ppicController.getAllocatedBatchMapping);

// Upload Excel -> Preview (Disesuaikan dengan ppicApi.js)
router.post('/upload/preview', upload.single('file'), ppicController.previewProduction);

// Konfirmasi Simpan Hasil Produksi ke DB (Disesuaikan dengan ppicApi.js)
router.post('/upload/commit', ppicController.confirmProduction);

module.exports = router;
