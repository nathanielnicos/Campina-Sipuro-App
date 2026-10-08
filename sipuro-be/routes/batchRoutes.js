const express = require('express');
const router = express.Router();
const multer = require('multer');
const batchController = require('../controllers/batch/batchController');
const { MAX_UPLOAD_FILE_BYTES } = require('../helpers/productionUploadConfig');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_FILE_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
        if (/\.(xlsx|xls)$/i.test(file.originalname || '')) return cb(null, true);
        const err = new Error('INVALID_FILE_TYPE');
        err.code = 'INVALID_FILE_TYPE';
        return cb(err);
    }
});

// Membungkus multer agar error upload dikembalikan sebagai JSON yang jelas
const handleExcelUpload = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (!err) return next();

        if (err.code === 'LIMIT_FILE_SIZE') {
            const mb = Math.round(MAX_UPLOAD_FILE_BYTES / (1024 * 1024));
            return res.status(413).json({ success: false, message: `File is too large. The maximum size is ${mb} MB.` });
        }
        if (err.code === 'INVALID_FILE_TYPE') {
            return res.status(400).json({ success: false, message: 'Only Excel files (.xlsx or .xls) are allowed.' });
        }
        console.error('Upload error:', err);
        return res.status(400).json({ success: false, message: 'Failed to read the uploaded file.' });
    });
};

// 1. RUTE STATIS (GET)
router.get('/export-batch-excel', batchController.exportBatchMappingExcel);
router.get('/outstanding-summary', batchController.getOutstandingSummary);
router.get('/batch-mapping', batchController.getAllocatedBatchMapping);

// 2. RUTE DINAMIS (GET dengan Parameter)
router.get('/allocation-logs/:allocationId', batchController.getAllocationHistory);

// 3. RUTE ACTION / MUTASI (POST)
router.post('/production/preview', handleExcelUpload, batchController.previewExcelUpload);
router.post('/production/commit', handleExcelUpload, batchController.commitExcelAllocation);
router.patch('/allocation/:allocationId/status', batchController.updateAllocationStatus);
router.patch('/allocation/:allocationId/qty', batchController.updateAllocationQty);

module.exports = router;
