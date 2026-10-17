const { sipuroDb } = require('../config/db');
const { safeError } = require('../helpers/safeError');

/**
 * Penerima notifikasi ditentukan dari token login (req.user), bukan dari query/body.
 *  - CUSTOMER : recipient_id = customer_id (level perusahaan)
 *  - EMPLOYEE : recipient_id = id karyawan ATAU recipient_department = departemennya
 * Mengembalikan potongan WHERE + parameternya.
 */
const recipientFilter = (user) => {
    if (user.type === 'CUSTOMER') {
        return {
            where: `recipient_type = 'CUSTOMER' AND recipient_id = ?`,
            params: [user.customerId]
        };
    }
    const department = user.department ? String(user.department).trim() : null;
    return {
        where: `recipient_type = 'EMPLOYEE' AND (recipient_id = ? OR recipient_department = ?)`,
        params: [user.id, department]
    };
};

const serverError = (res, error) =>
    res.status(500).json({ success: false, message: 'Server error', error: safeError(error) });

// Mengambil jumlah notifikasi belum dibaca
exports.getUnreadCount = async (req, res) => {
    try {
        const { where, params } = recipientFilter(req.user);
        const [rows] = await sipuroDb.query(
            `SELECT COUNT(*) AS count FROM sipuro_db.notifications WHERE is_read = FALSE AND ${where}`,
            params
        );
        return res.json({ count: rows[0].count });
    } catch (error) {
        return serverError(res, error);
    }
};

// Mengambil notifikasi terbaru dengan dukungan pagination / load more
exports.getNotifications = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const offset = (page - 1) * limit;

        const { where, params } = recipientFilter(req.user);

        const [rows] = await sipuroDb.query(
            `SELECT * FROM sipuro_db.notifications WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        const [countRows] = await sipuroDb.query(
            `SELECT COUNT(*) AS total FROM sipuro_db.notifications WHERE ${where}`,
            params
        );

        const totalData = countRows[0].total;
        const hasMore = offset + rows.length < totalData;

        return res.json({
            data: rows,
            pagination: { page, limit, totalData, hasMore }
        });
    } catch (error) {
        return serverError(res, error);
    }
};

// Tandai notifikasi spesifik sebagai sudah dibaca (hanya milik penerima yang login)
exports.markAsRead = async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid notification id.' });
        }

        const { where, params } = recipientFilter(req.user);
        const [result] = await sipuroDb.query(
            `UPDATE sipuro_db.notifications SET is_read = TRUE WHERE id = ? AND ${where}`,
            [id, ...params]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Notification not found.' });
        }
        return res.json({ success: true, message: 'Notification marked as read.' });
    } catch (error) {
        return serverError(res, error);
    }
};

// Tandai SEMUA notifikasi penerima sebagai sudah dibaca
exports.markAllAsRead = async (req, res) => {
    try {
        const { where, params } = recipientFilter(req.user);
        await sipuroDb.query(
            `UPDATE sipuro_db.notifications SET is_read = TRUE WHERE is_read = FALSE AND ${where}`,
            params
        );
        return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error) {
        return serverError(res, error);
    }
};
