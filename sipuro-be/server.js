const express = require('express');
const cors = require('cors');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const masterRoutes = require('./routes/masterRoutes');
const poRoutes = require('./routes/poRoutes');
const ppicRoutes = require('./routes/ppicRoutes');

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
app.use('/api/po', poRoutes);
app.use('/api/ppic', ppicRoutes);

// Run Server
app.listen(PORT, () => {
    console.log(`Server Express berjalan di port ${PORT}`);
});
