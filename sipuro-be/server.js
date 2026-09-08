const express = require('express');
const cors = require('cors');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const masterRoutes = require('./routes/masterRoutes');
const masterUploadRoutes = require('./routes/masterUploadRoutes'); // Tambahan: Route Upload Master Produk & Harga
const superadminRoutes = require('./routes/superadminRoutes');     // Rute khusus Superadmin
const poRoutes = require('./routes/poRoutes');
const batchRoutes = require('./routes/batchRoutes');
const productionUploadRoutes = require('./routes/productionUploadRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
app.use('/api/upload/production', productionUploadRoutes);
app.use('/api/notifications', notificationRoutes);

// Run Server
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});

module.exports = app;
