const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/authController');
const { requireAuth } = require('../middleware/auth');

// Public Auth Routes
router.post('/login', authController.login);
router.post('/register', authController.register);

// Profile Routes (identitas pengguna diambil dari token, bukan dari parameter klien)
router.get('/profile', requireAuth, authController.getProfile);
router.put('/change-password', requireAuth, authController.changePassword);

module.exports = router;
