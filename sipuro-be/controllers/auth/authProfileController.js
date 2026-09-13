const { sipuroDb } = require('../../config/db');
const { comparePassword, hashPassword } = require('../../helpers/authHelper');

exports.getProfile = async (req, res) => {
    try {
        const { user_id, role } = req.query;

        if (!user_id || !role) {
            return res.status(400).json({ success: false, message: 'User ID and Role are required.' });
        }

        if (role === 'CUSTOMER') {
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
            const [rows] = await sipuroDb.query(query, [user_id]);
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

            return res.json({ success: true, data: rows[0] });
        } else {
            const query = `
                SELECT 
                    id, 
                    employee_code AS code, 
                    full_name, 
                    gender, 
                    DATE_FORMAT(birth_date, '%Y-%m-%d') AS birth_date, 
                    department,
                    role, 
                    DATE_FORMAT(join_date, '%Y-%m-%d') AS join_date
                FROM sipuro_db.employees
                WHERE id = ?
            `;
            const [rows] = await sipuroDb.query(query, [user_id]);
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Employee not found.' });

            return res.json({ success: true, data: rows[0] });
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch profile.', error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { user_id, role, full_name, email, gender, birth_date } = req.body;

        if (!user_id || !role) {
            return res.status(400).json({ success: false, message: 'User ID and Role are required.' });
        }

        if (role === 'CUSTOMER') {
            if (!full_name || !email) {
                return res.status(400).json({ success: false, message: 'Full name and email are required.' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ success: false, message: 'Invalid email format.' });
            }

            await sipuroDb.query(
                'UPDATE sipuro_db.customer_users SET full_name = ?, email = ? WHERE customer_user_id = ?',
                [full_name, email, user_id]
            );

            return res.json({
                success: true,
                message: 'Profile updated successfully.',
                data: { full_name, email }
            });
        } else {
            if (!full_name || !gender || !birth_date) {
                return res.status(400).json({ success: false, message: 'Full name, gender, and birth date are required.' });
            }

            await sipuroDb.query(
                'UPDATE sipuro_db.employees SET full_name = ?, gender = ?, birth_date = ? WHERE id = ?',
                [full_name, gender, birth_date, user_id]
            );

            return res.json({
                success: true,
                message: 'Profile updated successfully.',
                data: { full_name, gender, birth_date }
            });
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ success: false, message: 'Failed to update profile.', error: error.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { user_id, role, currentPassword, newPassword } = req.body;

        if (!user_id || !role) {
            return res.status(400).json({ success: false, message: 'User ID and Role are required.' });
        }

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
        }

        const userTable = role === 'CUSTOMER' ? 'customer_users' : 'employees';
        const idColumn = role === 'CUSTOMER' ? 'customer_user_id' : 'id';

        const [rows] = await sipuroDb.query(
            `SELECT password FROM sipuro_db.${userTable} WHERE ${idColumn} = ?`,
            [user_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const isMatch = await comparePassword(currentPassword, rows[0].password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Incorrect current password.' });
        }

        const encryptedPassword = await hashPassword(newPassword);
        await sipuroDb.query(
            `UPDATE sipuro_db.${userTable} SET password = ? WHERE ${idColumn} = ?`,
            [encryptedPassword, user_id]
        );

        return res.json({
            success: true,
            message: 'Password changed successfully.'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        return res.status(500).json({ success: false, message: 'Failed to change password.', error: error.message });
    }
};
