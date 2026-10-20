const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch/batchController');
const { handleExcelUpload } = require('../middleware/excelUpload');
const { requireAccess } = require('../middleware/auth');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Di sini hanya pembatasan per kelompok pengguna:
//  - Ringkasan outstanding: customer (hanya PO miliknya, disaring di controller), PPIC, SUPERADMIN.
//  - Semua rute lain (mapping, export, log, upload produksi, ubah alokasi): hanya PPIC.
// Pembatasan dipasang SEBELUM middleware upload, sehingga file dari pengguna yang tidak berhak
// tidak pernah diproses.
const viewOutstanding = requireAccess('CUSTOMER', 'PPIC', 'SUPERADMIN');
const ppicOnly = requireAccess('PPIC');

// 1. RUTE STATIS (GET)
router.get('/export-batch-excel', ppicOnly, batchController.exportBatchMappingExcel);
router.get('/outstanding-summary', viewOutstanding, batchController.getOutstandingSummary);
router.get('/batch-mapping', ppicOnly, batchController.getAllocatedBatchMapping);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/allocation-logs/:allocationId', ppicOnly, batchController.getAllocationHistory);

// 3. RUTE ACTION / MUTASI (POST / PATCH)
router.post('/production/preview', ppicOnly, handleExcelUpload, batchController.previewExcelUpload);
router.post('/production/commit', ppicOnly, handleExcelUpload, batchController.commitExcelAllocation);
router.patch('/allocation/:allocationId/status', ppicOnly, batchController.updateAllocationStatus);
router.patch('/allocation/:allocationId/qty', ppicOnly, batchController.updateAllocationQty);

module.exports = router;
