const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');
const { requireAccess } = require('../middleware/auth');

// Mengambil produk aktif & harga berlaku saat ini (untuk katalog/order)
router.get('/products', masterController.getProducts);
router.get('/company-profile', masterController.getCompanyProfile);
// Customer hanya boleh membaca perusahaannya sendiri (dicek di controller); PPIC & SUPERADMIN bebas
router.get('/customers/:id', requireAccess('CUSTOMER', 'PPIC', 'SUPERADMIN'), masterController.getCustomerDetail);

module.exports = router;
