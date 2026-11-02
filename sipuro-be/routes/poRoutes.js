const express = require('express');
const router = express.Router();
const poController = require('../controllers/po/poController');
const { requirePermission } = require('../middleware/requirePermission');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Izin per kelompok diatur Superadmin (menu Access Permission). Kepemilikan data customer tetap disaring di controller.
const viewPO = requirePermission('PO', 'read');
const createPO = requirePermission('PO', 'create');
const editPO = requirePermission('PO', 'update'); // ubah dan batalkan
const exportPO = requirePermission('PO', 'export');
const approvePO = requirePermission('PO', 'approve'); // ubah status
const viewSettings = requirePermission('SETTINGS', 'read');
const editSettings = requirePermission('SETTINGS', 'update');

// 1. Endpoint Statis / Root Path (Wajib di Atas)
router.get('/', viewPO, poController.getPOList);
router.post('/', createPO, poController.createPO);
router.get('/export-excel', exportPO, poController.exportPoExcel);
router.get('/po-settings', viewSettings, poController.getPoSettings);
router.put('/po-settings', editSettings, poController.updatePoSettings);

// 2. Endpoint Dinamis Spesifik / Sub-resource Berparameter
router.patch('/:id/cancel', editPO, poController.cancelPO);
router.put('/:id/status', approvePO, poController.updatePOStatus);

// 3. Endpoint Dinamis Umum / Utama (:id)
router.get('/:id', viewPO, poController.getPODetail);
router.put('/:id', editPO, poController.updatePO);

module.exports = router;
