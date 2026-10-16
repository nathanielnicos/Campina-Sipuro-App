require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const masterRoutes = require('./routes/masterRoutes');
const masterUploadRoutes = require('./routes/masterUploadRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const poRoutes = require('./routes/poRoutes');
const batchRoutes = require('./routes/batchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const documentFlowRoutes = require('./routes/documentFlowRoutes');
const productionSchedule = require('./routes/productionScheduleRoutes');

const app = express();

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = Boolean(process.env.VERCEL);

// ---------------------------------------------------------------------------
// CORS
// CORS_ORIGIN = daftar origin frontend dipisah koma, contoh:
//   http://localhost:3000,https://sipuro-fe.vercel.app
// Jika kosong, semua origin diizinkan (perilaku lama) dan peringatan dicatat di log.
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

if (allowedOrigins.length === 0) {
    console.warn('[CORS] CORS_ORIGIN belum diisi: semua origin diizinkan. Isi CORS_ORIGIN dengan alamat frontend.');
    app.use(cors());
} else {
    app.use(cors({
        origin: (origin, callback) => {
            // Request tanpa header Origin (server ke server, curl) tetap diizinkan.
            if (!origin) return callback(null, true);
            return callback(null, allowedOrigins.includes(origin.replace(/\/+$/, '')));
        }
    }));
}

// Middleware body parser (upload file memakai multer, tidak terpengaruh batas ini)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Root Test Route
app.get('/', (req, res) => {
    res.send('SIPURO Backend Server is ready.');
});

// Register API Routes
app.use('/api', authRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', masterRoutes);
app.use('/api/upload/master', masterUploadRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/po', poRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/document-flow', documentFlowRoutes);
app.use('/api/production-schedule', productionSchedule);

// Route pengujian hanya tersedia di luar production
if (!isProduction) {
    const testRoutes = require('./routes/testRoutes');
    app.use('/api/test', testRoutes);
}

// 404 handler (route tidak ditemukan)
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global error handler (harus paling akhir, 4 parameter)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Request body is too large.' });
    }
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Invalid JSON in request body.' });
    }

    console.error('Unhandled server error:', err);

    const status = err && Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
    const body = { success: false, message: status === 500 ? 'Internal server error.' : (err.message || 'Request failed.') };
    if (process.env.NODE_ENV === 'development' && err && err.message) {
        body.error = err.message;
    }
    return res.status(status).json(body);
});

// Jalankan server hanya di luar Vercel. Vercel memakai export `app` sebagai handler,
// dan scheduler cron tidak dijalankan di sana (serverless tidak punya proses yang terus hidup).
if (!isVercel) {
    app.listen(PORT, () => {
        console.log(`Express server running on port ${PORT}`);

        try {
            const { initPoPlanScheduler } = require('./jobs/poPlanScheduler');
            initPoPlanScheduler();
        } catch (error) {
            console.error('Gagal menjalankan scheduler:', error);
        }
    });
}

module.exports = app;
