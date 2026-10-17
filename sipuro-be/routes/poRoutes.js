const express = require('express');
const router = express.Router();
const poController = require('../controllers/po/poController');
const { requireAccess } = require('../middleware/auth');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Di sini hanya pembatasan per kelompok pengguna.
const viewPO = requireAccess('CUSTOMER', 'PPIC', 'SUPERADMIN');
const customerOnly = requireAccess('CUSTOMER');
const ppicOnly = requireAccess('PPIC');
const superadminOnly = requireAccess('SUPERADMIN');

// 1. Endpoint Statis / Root Path (Wajib di Atas)
router.get('/', viewPO, poController.getPOList);
router.post('/', customerOnly, poController.createPO);
router.get('/export-excel', customerOnly, poController.exportPoExcel);
router.get('/po-settings', superadminOnly, poController.getPoSettings);
router.put('/po-settings', superadminOnly, poController.updatePoSettings);

// 2. Endpoint Item Close Request & Approval (Wajib sebelum /:id)
router.post('/details/request-close', customerOnly, poController.requestClosePoDetails);
router.post('/details/approve-close', ppicOnly, poController.approveClosePoDetails);
router.post('/details/reject-close', ppicOnly, poController.rejectClosePoDetails);

// 3. Endpoint Dinamis Spesifik / Sub-resource Berparameter
router.patch('/:id/cancel', customerOnly, poController.cancelPO);
router.put('/:id/status', ppicOnly, poController.updatePOStatus);

// 4. Endpoint Dinamis Umum / Utama (:id)
router.get('/:id', viewPO, poController.getPODetail);
router.put('/:id', customerOnly, poController.updatePO);

module.exports = router;
