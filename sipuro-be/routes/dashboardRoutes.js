const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard/dashboardController');
const { requireAccess } = require('../middleware/auth');

// Endpoint Statistik Dasbor
router.get('/dashboard-stats', requireAccess('PPIC', 'SUPERADMIN'), dashboardController.getDashboardStats);

module.exports = router;
