const express = require('express');
const router = express.Router();
const outstandingPoController = require('../controllers/outstanding-po/outstandingPoController');
const { requireAccess } = require('../middleware/auth');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Di sini hanya pembatasan per kelompok pengguna:
//  - Daftar: customer (hanya PO miliknya, disaring di controller), PPIC, SUPERADMIN.
//  - Ajukan close: customer. Setujui / tolak: PPIC.
const viewOutstanding = requireAccess('CUSTOMER', 'PPIC', 'SUPERADMIN');
const customerOnly = requireAccess('CUSTOMER');
const ppicOnly = requireAccess('PPIC');

router.get('/', viewOutstanding, outstandingPoController.getOutstandingList);

router.post('/items/:poDetailId/request-close', customerOnly, outstandingPoController.requestClose);
router.post('/items/:poDetailId/approve-close', ppicOnly, outstandingPoController.approveClose);
router.post('/items/:poDetailId/reject-close', ppicOnly, outstandingPoController.rejectClose);

module.exports = router;
