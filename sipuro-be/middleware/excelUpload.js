const multer = require('multer');
const { MAX_UPLOAD_FILE_BYTES } = require('../helpers/upload-production/productionUploadConfig');

/**
 * Shared Excel upload middleware (single file, field name "file", .xlsx / .xls only).
 * Extracted from routes/batchRoutes.js so Production upload and Document Flow upload behave the same.
 * Upload errors are returned as clear JSON.
 */
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

module.exports = { handleExcelUpload };
