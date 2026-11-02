const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard/dashboardController');
const { requirePermission } = require('../middleware/requirePermission');

// Endpoint Statistik Dasbor
router.get('/dashboard-stats', requirePermission('DASHBOARD', 'read'), dashboardController.getDashboardStats);

module.exports = router;
