const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/unread-count', notificationController.getUnreadCount);
router.get('/', notificationController.getNotifications);
router.put('/mark-all-read', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

module.exports = router;
