const express = require('express');
const router = express.Router();

const dataController = require('../controllers/superadmin/data/dataController');

// MENU 1: Master Produk (Lihat Tabel)
router.get('/products', dataController.getAllProducts);

// MENU 2: Master Harga (Lihat Tabel)
router.get('/prices', dataController.getAllPrices);

// MENU 3: Master Karyawan (Lihat Tabel & Toggle Status)
router.get('/employees', dataController.getAllEmployees);
router.put('/employees/:id/toggle-status', dataController.toggleEmployeeStatus);

// MENU 4: Master Customer (Lihat Tabel & Toggle Status)
router.get('/customer-users', dataController.getAllCustomerUsers);
router.put('/customer-users/:id/toggle-status', dataController.toggleCustomerUserStatus);

module.exports = router;
