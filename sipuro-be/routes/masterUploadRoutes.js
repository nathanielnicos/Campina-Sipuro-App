const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/superadmin/upload/uploadController');
const { requireAccess } = require('../middleware/auth');

// Upload master data: hanya SUPERADMIN
router.use(requireAccess('SUPERADMIN'));

const upload = multer({ storage: multer.memoryStorage() });

router.post('/products/preview', upload.single('file'), uploadController.previewProducts);
router.post('/products/commit', uploadController.commitProducts);

router.post('/prices/preview', upload.single('file'), uploadController.previewPrices);
router.post('/prices/commit', uploadController.commitPrices);

module.exports = router;
