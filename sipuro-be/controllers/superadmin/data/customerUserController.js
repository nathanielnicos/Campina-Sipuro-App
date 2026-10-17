const { sipuroDb } = require('../../../config/db');
const { safeError } = require('../../../helpers/safeError');

/**
 * Mengubah nilai status dari request menjadi 1 / 0 secara ketat.
 * Menerima true/false, 1/0, "true"/"false", "1"/"0". Nilai lain -> null (ditolak).
 * (Sebelumnya string "false" dianggap true.)
 */
const parseFlag = (value) => {
    if (value === true || value === 1 || value === '1' || value === 'true') return 1;
    if (value === false || value === 0 || value === '0' || value === 'false') return 0;
    return null;
};

/**
 * 1. Menarik daftar Customer Users dari DB (Server-side Pagination & Search)
 */
exports.getAllCustomerUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        const conditions = [];
        const queryParams = [];

        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            conditions.push('(cu.customer_user_code LIKE ? OR cu.full_name LIKE ? OR cu.email LIKE ? OR c.company_name LIKE ?)');
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `
            SELECT COUNT(*) AS total 
            FROM sipuro_db.customer_users cu
            JOIN sipuro_db.customers c ON cu.customer_id = c.customer_id
            ${whereClause}
        `;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = countRows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum);

        const query = `
            SELECT 
                cu.customer_user_id,
                cu.customer_id,
                cu.customer_user_code,
                cu.full_name,
                cu.email,
                cu.allowed_ip,
                cu.last_login_ip,
                cu.last_login_at,
                cu.is_active,
                cu.created_at,
                c.customer_code,
                c.company_name
            FROM sipuro_db.customer_users cu
            JOIN sipuro_db.customers c ON cu.customer_id = c.customer_id
            ${whereClause}
            ORDER BY cu.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await sipuroDb.query(query, [...queryParams, limitNum, offset]);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching customer users:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch customer user data from the database.', error: safeError(error) });
    }
};

/**
 * 2. Toggle Status Aktif Customer User
 */
exports.toggleCustomerUserStatus = async (req, res) => {
    try {
        const targetId = Number.parseInt(req.params.id, 10);
        const { is_active } = req.body || {};

        if (!Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid customer user id.' });
        }

        if (is_active === undefined) {
            return res.status(400).json({ success: false, message: 'The is_active status is required.' });
        }

        const activeFlag = parseFlag(is_active);
        if (activeFlag === null) {
            return res.status(400).json({ success: false, message: 'The is_active status must be true or false.' });
        }

        const [targetRows] = await sipuroDb.query(
            'SELECT customer_user_id FROM sipuro_db.customer_users WHERE customer_user_id = ?',
            [targetId]
        );
        if (targetRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Customer user not found.' });
        }

        await sipuroDb.query(
            'UPDATE sipuro_db.customer_users SET is_active = ? WHERE customer_user_id = ?',
            [activeFlag, targetId]
        );

        return res.json({
            success: true,
            message: 'Customer user status updated successfully.'
        });
    } catch (error) {
        console.error('Error toggling customer user status:', error);
        return res.status(500).json({ success: false, message: 'Failed to update customer user status.', error: safeError(error) });
    }
};
