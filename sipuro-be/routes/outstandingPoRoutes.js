const express = require('express');
const router = express.Router();
const outstandingPoController = require('../controllers/outstanding-po/outstandingPoController');
const { requirePermission } = require('../middleware/requirePermission');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Izin per kelompok diatur Superadmin (menu Access Permission). Awalnya:
//  - Daftar: customer (hanya PO miliknya, disaring di controller), PPIC, SUPERADMIN.
//  - Ajukan close: customer. Setujui / tolak: PPIC.
const viewOutstanding = requirePermission('OUTSTANDING_PO', 'read');
const requestClose = requirePermission('OUTSTANDING_PO', 'create');
const approveClose = requirePermission('OUTSTANDING_PO', 'approve');

router.get('/', viewOutstanding, outstandingPoController.getOutstandingList);

router.post('/items/:poDetailId/request-close', requestClose, outstandingPoController.requestClose);
router.post('/items/:poDetailId/approve-close', approveClose, outstandingPoController.approveClose);
router.post('/items/:poDetailId/reject-close', approveClose, outstandingPoController.rejectClose);

module.exports = router;
