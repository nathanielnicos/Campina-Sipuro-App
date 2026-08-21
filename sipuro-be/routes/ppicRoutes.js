const express = require('express');
const router = express.Router();
const multer = require('multer');
const ppicController = require('../controllers/ppicController');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/allocations', ppicController.allocateBatch);
router.post('/upload-production', upload.single('excel_file'), ppicController.uploadProduction);

module.exports = router;
