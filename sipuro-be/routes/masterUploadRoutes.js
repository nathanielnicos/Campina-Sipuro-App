const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/superadmin/upload/uploadController');
const { requirePermission } = require('../middleware/requirePermission');

// Upload master data: izin per menu (awalnya hanya SUPERADMIN)
const uploadProducts = requirePermission('PRODUCTS', 'upload');
const uploadPrices = requirePermission('PRICES', 'upload');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/products/preview', uploadProducts, upload.single('file'), uploadController.previewProducts);
router.post('/products/commit', uploadProducts, uploadController.commitProducts);

router.post('/prices/preview', uploadPrices, upload.single('file'), uploadController.previewPrices);
router.post('/prices/commit', uploadPrices, uploadController.commitPrices);

module.exports = router;
