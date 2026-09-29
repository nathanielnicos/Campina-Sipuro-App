const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth/authController');

// Public Auth Routes
router.post('/login', authController.login);
router.post('/register', authController.register);

// Profile Routes (Menerima parameter user_id & role langsung)
router.get('/profile', authController.getProfile);
router.put('/change-password', authController.changePassword);

module.exports = router;