const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard/dashboardController');

// Endpoint Statistik Dasbor
router.get('/dashboard-stats', dashboardController.getDashboardStats);

module.exports = router;
