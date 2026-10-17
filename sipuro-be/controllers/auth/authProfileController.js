const { sipuroDb } = require('../../config/db');
const { comparePassword, hashPassword, validateNewPassword } = require('../../helpers/authHelper');
const { safeError } = require('../../helpers/safeError');

/**
 * Profil akun yang sedang login. Identitas diambil dari token (req.user), bukan dari parameter klien.
 */
exports.getProfile = async (req, res) => {
    try {
        const user = req.user;

        if (user.type === 'CUSTOMER') {
            const query = `
                SELECT 
                    cu.customer_user_id AS id, 
                    cu.customer_user_code AS code, 
                    cu.full_name, 
                    cu.email, 
                    c.customer_code, 
                    c.company_name
                FROM sipuro_db.customer_users cu
                JOIN sipuro_db.customers c ON cu.customer_id = c.customer_id
                WHERE cu.customer_user_id = ?
            `;
            const [rows] = await sipuroDb.query(query, [user.id]);
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

            return res.json({ success: true, data: rows[0] });
        }

        const query = `
            SELECT 
                id, 
                employee_code AS code, 
                full_name, 
                email,
                gender, 
                DATE_FORMAT(birth_date, '%Y-%m-%d') AS birth_date, 
                department,
                role, 
                DATE_FORMAT(join_date, '%Y-%m-%d') AS join_date
            FROM sipuro_db.employees
            WHERE id = ?
        `;
        const [rows] = await sipuroDb.query(query, [user.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Employee not found.' });

        return res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch profile.', error: safeError(error) });
    }
};

/**
 * Ganti password akun yang sedang login (identitas dari token).
 */
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        const user = req.user;

        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
        }

        const passwordError = validateNewPassword(newPassword);
        if (passwordError) {
            return res.status(400).json({ success: false, message: passwordError });
        }

        const isCustomer = user.type === 'CUSTOMER';
        const userTable = isCustomer ? 'customer_users' : 'employees';
        const idColumn = isCustomer ? 'customer_user_id' : 'id';

        const [rows] = await sipuroDb.query(
            `SELECT password FROM sipuro_db.${userTable} WHERE ${idColumn} = ?`,
            [user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const isMatch = await comparePassword(currentPassword, rows[0].password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Incorrect current password.', code: 'WRONG_CURRENT_PASSWORD' });
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
        }

        const encryptedPassword = await hashPassword(newPassword);
        await sipuroDb.query(
            `UPDATE sipuro_db.${userTable} SET password = ? WHERE ${idColumn} = ?`,
            [encryptedPassword, user.id]
        );

        return res.json({
            success: true,
            message: 'Password changed successfully.'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(500).json({ success: false, message: 'Failed to change password.', error: safeError(error) });
    }
};
