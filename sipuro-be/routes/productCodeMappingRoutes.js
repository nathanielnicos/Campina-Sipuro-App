const express = require('express');
const router = express.Router();
const { listProductCodeMappings } = require('../controllers/product-code-mapping/productCodeMappingListController');
const { createProductCodeMapping } = require('../controllers/product-code-mapping/productCodeMappingCreateController');
const { updateProductCodeMappingStatus } = require('../controllers/product-code-mapping/productCodeMappingStatusController');
const { requireAccess } = require('../middleware/auth');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Pemetaan kode produk memengaruhi alokasi PO, jadi hanya SUPERADMIN yang boleh melihat dan mengubahnya.
// Tidak ada hapus: pemetaan diaktifkan/dinonaktifkan.
const superadminOnly = requireAccess('SUPERADMIN');

router.get('/', superadminOnly, listProductCodeMappings);
router.post('/', superadminOnly, createProductCodeMapping);
router.patch('/:mappingId/status', superadminOnly, updateProductCodeMappingStatus);

module.exports = router;
