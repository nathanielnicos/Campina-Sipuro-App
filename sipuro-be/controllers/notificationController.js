const { sipuroDb } = require('../config/db');

// Mengambil jumlah notifikasi belum dibaca
exports.getUnreadCount = async (req, res) => {
    try {
        const { role, userId, department } = req.query;
        const isCustomer = role && role.toLowerCase() === 'customer';

        let query = '';
        let params = [];

        if (isCustomer) {
            query = `
                SELECT COUNT(*) AS count 
                FROM sipuro_db.notifications 
                WHERE is_read = FALSE 
                  AND recipient_type = 'CUSTOMER' 
                  AND recipient_id = ?
            `;
            params = [userId];
        } else {
            const cleanDepartment = department ? department.trim() : null;

            query = `
                SELECT COUNT(*) AS count 
                FROM sipuro_db.notifications 
                WHERE is_read = FALSE 
                AND recipient_type = 'EMPLOYEE' 
                AND (recipient_id = ? OR recipient_department = ?)
            `;
            params = [userId, cleanDepartment];
        }

        const [rows] = await sipuroDb.query(query, params);
        return res.json({ count: rows[0].count });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Mengambil notifikasi terbaru dengan dukungan pagination / load more
exports.getNotifications = async (req, res) => {
    try {
        const { role, userId, department } = req.query;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;

        const isCustomer = role && role.toLowerCase() === 'customer';

        let query = '';
        let countQuery = '';
        let params = [];
        let countParams = [];

        if (isCustomer) {
            query = `
                SELECT * 
                FROM sipuro_db.notifications 
                WHERE recipient_type = 'CUSTOMER' 
                  AND recipient_id = ?
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `;
            params = [userId, limit, offset];

            countQuery = `
                SELECT COUNT(*) AS total 
                FROM sipuro_db.notifications 
                WHERE recipient_type = 'CUSTOMER' 
                  AND recipient_id = ?
            `;
            countParams = [userId];
        } else {
            const cleanDepartment = department ? department.trim() : null;

            query = `
                SELECT * 
                FROM sipuro_db.notifications 
                WHERE recipient_type = 'EMPLOYEE' 
                AND (recipient_id = ? OR recipient_department = ?)
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            `;
            params = [userId, cleanDepartment, limit, offset];

            countQuery = `
                SELECT COUNT(*) AS total 
                FROM sipuro_db.notifications 
                WHERE recipient_type = 'EMPLOYEE' 
                AND (recipient_id = ? OR recipient_department = ?)
            `;
            countParams = [userId, cleanDepartment];
        }

        const [rows] = await sipuroDb.query(query, params);
        const [countRows] = await sipuroDb.query(countQuery, countParams);

        const totalData = countRows[0].total;
        const hasMore = offset + rows.length < totalData;

        return res.json({
            data: rows,
            pagination: {
                page,
                limit,
                totalData,
                hasMore
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Tandai notifikasi spesifik sebagai sudah dibaca
exports.markAsRead = async (req, res) => {
    const { id } = req.params;
    try {
        await sipuroDb.query('UPDATE sipuro_db.notifications SET is_read = TRUE WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Notification marked as read.' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Tandai SEMUA notifikasi penerima sebagai sudah dibaca
exports.markAllAsRead = async (req, res) => {
    try {
        const { role, userId, department } = req.body;
        const isCustomer = role && role.toLowerCase() === 'customer';

        let query = '';
        let params = [];

        if (isCustomer) {
            query = `
                UPDATE sipuro_db.notifications 
                SET is_read = TRUE 
                WHERE is_read = FALSE 
                  AND recipient_type = 'CUSTOMER' 
                  AND recipient_id = ?
            `;
            params = [userId];
        } else {
            const cleanDepartment = department ? department.trim() : null;

            query = `
                UPDATE sipuro_db.notifications 
                SET is_read = TRUE 
                WHERE is_read = FALSE 
                AND recipient_type = 'EMPLOYEE' 
                AND (recipient_id = ? OR recipient_department = ?)
            `;
            params = [userId, cleanDepartment];
        }

        await sipuroDb.query(query, params);
        return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};
