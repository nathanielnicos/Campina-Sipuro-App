const express = require('express');
const router = express.Router();
const multer = require('multer');
const masterUploadController = require('../controllers/masterUploadController');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/products/preview', upload.single('file'), masterUploadController.previewProducts);
router.post('/products/commit', masterUploadController.commitProducts);

router.post('/prices/preview', upload.single('file'), masterUploadController.previewPrices);
router.post('/prices/commit', masterUploadController.commitPrices);

module.exports = router;
