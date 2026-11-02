const express = require('express');
const router = express.Router();
const { getAllocatedLotMapping } = require('../controllers/production-lot/allocation/lotMappingListController');
const { getAllocationHistory } = require('../controllers/production-lot/allocation/lotAllocationLogController');
const { updateAllocationQty } = require('../controllers/production-lot/allocation/lotAllocationQtyController');
const { exportLotMappingExcel } = require('../controllers/production-lot/export/lotExportController');
const { previewExcelUpload } = require('../controllers/production-lot/import/lotUploadPreviewController');
const { commitExcelAllocation } = require('../controllers/production-lot/import/lotUploadCommitController');
const { handleExcelUpload } = require('../middleware/excelUpload');
const { requirePermission } = require('../middleware/requirePermission');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Izin per kelompok diatur Superadmin (menu Access Permission); awalnya seluruh rute Production Lot hanya untuk PPIC.
// Pembatasan dipasang SEBELUM middleware upload, sehingga file dari pengguna yang tidak berhak
// tidak pernah diproses.
const canView = requirePermission('PRODUCTION_LOT', 'read');
const canExport = requirePermission('PRODUCTION_LOT', 'export');
const canUpload = requirePermission('PRODUCTION_LOT', 'upload');
const canUpdate = requirePermission('PRODUCTION_LOT', 'update');

// 1. RUTE STATIS (GET)
router.get('/mapping', canView, getAllocatedLotMapping);
router.get('/export', canExport, exportLotMappingExcel);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/allocations/:allocationId/logs', canView, getAllocationHistory);

// 3. RUTE ACTION / MUTASI (POST / PATCH)
router.post('/upload/preview', canUpload, handleExcelUpload, previewExcelUpload);
router.post('/upload/commit', canUpload, handleExcelUpload, commitExcelAllocation);
router.patch('/allocations/:allocationId/qty', canUpdate, updateAllocationQty);

module.exports = router;
