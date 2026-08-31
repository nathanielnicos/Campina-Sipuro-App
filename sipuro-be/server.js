const express = require('express');
const cors = require('cors');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const masterRoutes = require('./routes/masterRoutes');
const masterUploadRoutes = require('./routes/masterUploadRoutes'); // Tambahan: Route Upload Master Produk & Harga
const superadminRoutes = require('./routes/superadminRoutes');     // Rute khusus Superadmin
const poRoutes = require('./routes/poRoutes');
const ppicRoutes = require('./routes/ppicRoutes');
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
    res.send('Server Backend SIPURO Siap!');
});

// Register API Routes
app.use('/api', authRoutes);
app.use('/api', masterRoutes);
app.use('/api/upload/master', masterUploadRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/po', poRoutes);
app.use('/api/ppic', ppicRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/upload/production', productionUploadRoutes);
app.use('/api/notifications', notificationRoutes);

// Run Server
app.listen(PORT, () => {
    console.log(`Server Express berjalan di port ${PORT}`);
});
