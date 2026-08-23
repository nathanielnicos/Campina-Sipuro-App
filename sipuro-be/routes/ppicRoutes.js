const express = require('express');
const router = express.Router();
const multer = require('multer');
const ppicController = require('../controllers/ppicController');

const upload = multer({ storage: multer.memoryStorage() });

// Endpoints Rekap & Alokasi Batch
router.get('/unassigned-summary', ppicController.getUnassignedSummary);
router.get('/batches-by-sku/:id_product', ppicController.getBatchesBySku);
router.post('/assign-batch-bulk', ppicController.assignBatchBulk);

// Endpoint Monitoring Batch
router.get('/batch-mapping', ppicController.getAllocatedBatchMapping);

// Upload Excel -> Hanya Parse & Preview (Belum masuk DB)
router.post('/preview-production', upload.single('excel_file'), ppicController.previewProduction);

// Konfirmasi Simpan Hasil Produksi ke DB
router.post('/confirm-production', ppicController.confirmProduction);

module.exports = router;
