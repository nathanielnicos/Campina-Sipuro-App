const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');

// Mengambil produk aktif & harga berlaku saat ini (untuk katalog/order)
router.get('/products', masterController.getProducts);
router.get('/company-profile', masterController.getCompanyProfile);
router.get('/customers/:id', masterController.getCustomerDetail);

module.exports = router;
