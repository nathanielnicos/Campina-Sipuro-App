const express = require('express');
const router = express.Router();
const { getAllocatedLotMapping } = require('../controllers/production-lot/allocation/lotMappingListController');
const { getAllocationHistory } = require('../controllers/production-lot/allocation/lotAllocationLogController');
const { updateAllocationQty } = require('../controllers/production-lot/allocation/lotAllocationQtyController');
const { exportLotMappingExcel } = require('../controllers/production-lot/export/lotExportController');
const { previewExcelUpload } = require('../controllers/production-lot/import/lotUploadPreviewController');
const { commitExcelAllocation } = require('../controllers/production-lot/import/lotUploadCommitController');
const { handleExcelUpload } = require('../middleware/excelUpload');
const { requireAccess } = require('../middleware/auth');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Di sini hanya pembatasan per kelompok pengguna: seluruh rute Production Lot (mapping, export, riwayat, upload dan
// ubah alokasi) hanya untuk PPIC, sama seperti modul Batch yang digantikannya.
// Pembatasan dipasang SEBELUM middleware upload, sehingga file dari pengguna yang tidak berhak
// tidak pernah diproses.
const ppicOnly = requireAccess('PPIC');

// 1. RUTE STATIS (GET)
router.get('/mapping', ppicOnly, getAllocatedLotMapping);
router.get('/export', ppicOnly, exportLotMappingExcel);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/allocations/:allocationId/logs', ppicOnly, getAllocationHistory);

// 3. RUTE ACTION / MUTASI (POST / PATCH)
router.post('/upload/preview', ppicOnly, handleExcelUpload, previewExcelUpload);
router.post('/upload/commit', ppicOnly, handleExcelUpload, commitExcelAllocation);
router.patch('/allocations/:allocationId/qty', ppicOnly, updateAllocationQty);

module.exports = router;
