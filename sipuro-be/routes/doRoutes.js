const express = require('express');
const router = express.Router();
const doController = require('../controllers/do/doController');

// GET /api/delivery-orders
router.get('/', doController.getDeliveryOrders);

module.exports = router;
