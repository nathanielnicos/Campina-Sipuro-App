const express = require('express');
const router = express.Router();

const superadminController = require('../controllers/superadminController');

// MENU 1: Master Produk (Lihat Tabel)
router.get('/products', superadminController.getAllProducts);

// MENU 2: Master Harga (Lihat Tabel)
router.get('/prices', superadminController.getAllPrices);

// MENU 3: Master Karyawan (Lihat Tabel)
router.get('/employees', superadminController.getAllEmployees);

module.exports = router;
