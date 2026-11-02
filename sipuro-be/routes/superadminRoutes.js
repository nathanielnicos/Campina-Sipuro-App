const express = require('express');
const router = express.Router();

const dataController = require('../controllers/superadmin/data/dataController');
const { requirePermission } = require('../middleware/requirePermission');

// Data master & manajemen akun: izin per menu diatur Superadmin (menu Access Permission); awalnya hanya SUPERADMIN.

// MENU 1: Master Produk (Lihat Tabel)
router.get('/products', requirePermission('PRODUCTS', 'read'), dataController.getAllProducts);

// MENU 2: Master Harga (Lihat Tabel)
router.get('/prices', requirePermission('PRICES', 'read'), dataController.getAllPrices);

// MENU 3: Master Karyawan (Lihat Tabel & Toggle Status)
router.get('/employees', requirePermission('EMPLOYEES', 'read'), dataController.getAllEmployees);
router.put('/employees/:id/toggle-status', requirePermission('EMPLOYEES', 'update'), dataController.toggleEmployeeStatus);

// MENU 4: Master Customer (Lihat Tabel & Toggle Status)
router.get('/customer-users', requirePermission('CUSTOMERS', 'read'), dataController.getAllCustomerUsers);
router.put('/customer-users/:id/toggle-status', requirePermission('CUSTOMERS', 'update'), dataController.toggleCustomerUserStatus);

module.exports = router;
