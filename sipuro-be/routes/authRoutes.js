const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/authController');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, registerLimiter, passwordChangeLimiter } = require('../middleware/rateLimiters');

// Public Auth Routes
router.post('/login', loginLimiter, authController.login);
router.post('/register', registerLimiter, authController.register);

// Profile Routes (identitas pengguna diambil dari token, bukan dari parameter klien)
router.get('/profile', requireAuth, authController.getProfile);
router.put('/change-password', requireAuth, passwordChangeLimiter, authController.changePassword);

module.exports = router;
