const express = require('express');
const router = express.Router();
const multer = require('multer');
const productionUploadController = require('../controllers/ppic/productionUploadController');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/preview', upload.single('file'), productionUploadController.previewExcelUpload);
router.post('/commit', productionUploadController.commitExcelAllocation);

module.exports = router;
