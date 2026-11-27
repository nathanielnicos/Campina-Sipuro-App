require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const masterLookupRoutes = require('./routes/masterLookupRoutes');
const masterDataUploadRoutes = require('./routes/masterDataUploadRoutes');
const masterDataRoutes = require('./routes/masterDataRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const outstandingPoRoutes = require('./routes/outstandingPoRoutes');
const productionLotRoutes = require('./routes/productionLotRoutes');
const productCodeMappingRoutes = require('./routes/productCodeMappingRoutes');
const accessPermissionRoutes = require('./routes/accessPermissionRoutes');
const myPermissionsRoutes = require('./routes/myPermissionsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const deliveryOrderRoutes = require('./routes/deliveryOrderRoutes');
const uploadTransTypeRoutes = require('./routes/uploadTransTypeRoutes');
const uploadFormatRoutes = require('./routes/uploadFormatRoutes');
const salesInvoiceRoutes = require('./routes/salesInvoiceRoutes');
const productionScheduleRoutes = require('./routes/productionScheduleRoutes');
const { requireAuth } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimiters');

const app = express();

const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = Boolean(process.env.VERCEL);

// Di belakang proxy (Vercel) alamat IP pengunjung dibaca dari header X-Forwarded-For, dan hanya dipercaya bila memang ada proxy.
// TRUST_PROXY_HOPS = jumlah proxy di depan server (Vercel: 1). Di komputer lokal 0, supaya header itu tidak bisa dipalsukan.
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || (isVercel ? '1' : '0'), 10);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
}

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

// Route pengujian hanya tersedia di luar production (dipasang SEBELUM requireAuth agar bisa dibuka dari browser saat pengujian lokal)
if (!isProduction) {
    const testRoutes = require('./routes/testRoutes');
    app.use('/api/test', testRoutes);
}

// Pembatas jumlah permintaan untuk seluruh /api (dipasang sebelum route mana pun, termasuk login dan requireAuth)
app.use('/api', apiLimiter);

// Register API Routes
// 1) authRoutes: login & register publik; profile & change-password sudah dilindungi di dalam router-nya
app.use('/api', authRoutes);

// 2) Semua route /api/* di bawah ini WAJIB login (token Bearer). Pembatasan peran dipasang di masing-masing router.
app.use('/api', requireAuth);

app.use('/api', dashboardRoutes);
app.use('/api', masterLookupRoutes);
app.use('/api/upload/master', masterDataUploadRoutes);
app.use('/api/superadmin/product-code-mappings', productCodeMappingRoutes);
app.use('/api/superadmin/access-permissions', accessPermissionRoutes);
app.use('/api/superadmin', masterDataRoutes);
app.use('/api/po', purchaseOrderRoutes);
app.use('/api/outstanding-po', outstandingPoRoutes);
app.use('/api/production-lot', productionLotRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/permissions', myPermissionsRoutes);
app.use('/api/do', deliveryOrderRoutes);
app.use('/api/upload-trans-types', uploadTransTypeRoutes);
app.use('/api/upload-formats', uploadFormatRoutes);
app.use('/api/si', salesInvoiceRoutes);
app.use('/api/production-schedule', productionScheduleRoutes);

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
