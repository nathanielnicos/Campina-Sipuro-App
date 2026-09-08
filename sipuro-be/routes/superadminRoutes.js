const express = require('express');
const router = express.Router();

const superadminController = require('../controllers/superadminController');

// MENU 1: Master Produk (Lihat Tabel)
router.get('/products', superadminController.getAllProducts);

// MENU 2: Master Harga (Lihat Tabel)
router.get('/prices', superadminController.getAllPrices);

// MENU 3: Master Karyawan (Lihat Tabel & Toggle Status)
router.get('/employees', superadminController.getAllEmployees);
router.put('/employees/:id/toggle-status', superadminController.toggleEmployeeStatus);

// MENU 4: Master Customer (Lihat Tabel & Toggle Status)
router.get('/customer-users', superadminController.getAllCustomerUsers);
router.put('/customer-users/:id/toggle-status', superadminController.toggleCustomerUserStatus);

module.exports = router;
