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
const testRoutes = require('./routes/testRoutes'); // <-- Import testRoutes

const app = express();

// Import scheduler
const { initPoPlanScheduler } = require('./jobs/poPlanScheduler');

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
app.use('/api/test', testRoutes);

// Run Server
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);

    // Jalankan inisialisasi Cron Job Scheduler
    initPoPlanScheduler();
});

module.exports = app;
