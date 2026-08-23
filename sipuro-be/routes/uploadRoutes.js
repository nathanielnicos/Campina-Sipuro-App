const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');

// Multer memory storage (Simpan di RAM sementara untuk di-parse)
const upload = multer({ storage: multer.memoryStorage() });

router.post('/preview', upload.single('file'), uploadController.previewExcelUpload);
router.post('/commit', uploadController.commitExcelAllocation);

module.exports = router;
