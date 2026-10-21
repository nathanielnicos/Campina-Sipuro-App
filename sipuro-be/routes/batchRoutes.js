const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch/batchController');
const { handleExcelUpload } = require('../middleware/excelUpload');
const { requireAccess } = require('../middleware/auth');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Di sini hanya pembatasan per kelompok pengguna: semua rute Batch (mapping, export, log,
// upload produksi, ubah alokasi) hanya untuk PPIC. Outstanding PO kini modul sendiri
// (routes/outstandingPoRoutes.js).
// Pembatasan dipasang SEBELUM middleware upload, sehingga file dari pengguna yang tidak berhak
// tidak pernah diproses.
const ppicOnly = requireAccess('PPIC');

// 1. RUTE STATIS (GET)
router.get('/export-batch-excel', ppicOnly, batchController.exportBatchMappingExcel);
router.get('/batch-mapping', ppicOnly, batchController.getAllocatedBatchMapping);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/allocation-logs/:allocationId', ppicOnly, batchController.getAllocationHistory);

// 3. RUTE ACTION / MUTASI (POST / PATCH)
router.post('/production/preview', ppicOnly, handleExcelUpload, batchController.previewExcelUpload);
router.post('/production/commit', ppicOnly, handleExcelUpload, batchController.commitExcelAllocation);
router.patch('/allocation/:allocationId/status', ppicOnly, batchController.updateAllocationStatus);
router.patch('/allocation/:allocationId/qty', ppicOnly, batchController.updateAllocationQty);

module.exports = router;
