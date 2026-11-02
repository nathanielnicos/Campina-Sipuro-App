const express = require('express');
const router = express.Router();
const { listProductCodeMappings } = require('../controllers/product-code-mapping/productCodeMappingListController');
const { createProductCodeMapping } = require('../controllers/product-code-mapping/productCodeMappingCreateController');
const { updateProductCodeMappingStatus } = require('../controllers/product-code-mapping/productCodeMappingStatusController');
const { requirePermission } = require('../middleware/requirePermission');

// Login sudah diwajibkan secara global di server.js (requireAuth).
// Pemetaan kode produk memengaruhi alokasi PO, jadi awalnya hanya SUPERADMIN yang boleh melihat dan mengubahnya
// (izin diatur di menu Access Permission). Tidak ada hapus: pemetaan diaktifkan/dinonaktifkan.

router.get('/', requirePermission('PRODUCT_CODE_MAPPING', 'read'), listProductCodeMappings);
router.post('/', requirePermission('PRODUCT_CODE_MAPPING', 'create'), createProductCodeMapping);
router.patch('/:mappingId/status', requirePermission('PRODUCT_CODE_MAPPING', 'update'), updateProductCodeMappingStatus);

module.exports = router;
