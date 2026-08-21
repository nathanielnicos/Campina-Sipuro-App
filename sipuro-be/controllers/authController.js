const { sipuroDb, campinaDb } = require('../config/db');

exports.login = async (req, res) => {
    try {
        const { username, password, role_type } = req.body;

        if (!username || !password || !role_type) {
            return res.status(400).json({
                success: false,
                message: 'Username/Code, Password, dan Role Type wajib diisi.'
            });
        }

        if (role_type === 'CUSTOMER') {
            const query = `
                SELECT customer_id, customer_code, company_name, email 
                FROM sipuro_db.customers 
                WHERE customer_code = ? AND password = ? AND is_active = 1
            `;
            const [rows] = await sipuroDb.query(query, [username, password]);

            if (rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Kode Customer atau Password salah, atau akun tidak aktif.'
                });
            }

            const user = rows[0];
            return res.json({
                success: true,
                message: 'Login Customer berhasil',
                data: { id: user.customer_id, code: user.customer_code, name: user.company_name, role: 'CUSTOMER' }
            });

        } else if (role_type === 'EMPLOYEE') {
            const query = `
                SELECT employee_id, full_name, department, role 
                FROM campina_db.employees 
                WHERE employee_id = ? AND password = ? AND is_suspended = 0
            `;
            const [rows] = await campinaDb.query(query, [username, password]);

            if (rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Employee ID atau Password salah, atau akun Anda tidak aktif.'
                });
            }

            const emp = rows[0];
            return res.json({
                success: true,
                message: 'Login Employee berhasil',
                data: { id: emp.employee_id, code: emp.employee_id, name: emp.full_name, department: emp.department, role: emp.department }
            });

        } else {
            return res.status(400).json({ success: false, message: 'Role type tidak valid.' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login.', error: error.message });
    }
};
