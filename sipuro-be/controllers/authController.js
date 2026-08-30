const { sipuroDb } = require('../config/db');
const { comparePassword, getClientIp } = require('../helpers/authHelper');

exports.login = async (req, res) => {
    try {
        const { username, password, role_type } = req.body;
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        if (!username || !password || !role_type) {
            return res.status(400).json({
                success: false,
                message: 'Username/Code, Password, dan Role Type wajib diisi.'
            });
        }

        if (role_type === 'CUSTOMER') {
            const query = `
                SELECT customer_id, customer_code, company_name, email, password, is_active, allowed_ip 
                FROM sipuro_db.customers 
                WHERE customer_code = ?
            `;
            const [rows] = await sipuroDb.query(query, [username]);

            if (rows.length === 0) {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Kode Customer atau Password salah.' });
            }

            const user = rows[0];

            if (!user.is_active) {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'INACTIVE');
                return res.status(401).json({ success: false, message: 'Akun Anda tidak aktif.' });
            }

            // Validasi Pembatasan IP (Jika allowed_ip diisi)
            if (user.allowed_ip && user.allowed_ip !== clientIp && user.allowed_ip !== '*') {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'IP_BLOCKED');
                return res.status(403).json({
                    success: false,
                    message: `Akses ditolak. Perangkat/IP (${clientIp}) tidak terdaftar untuk akun ini.`
                });
            }

            // Validasi Enkripsi / Plain Password
            const isMatch = await comparePassword(password, user.password);
            if (!isMatch) {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Kode Customer atau Password salah.' });
            }

            // Update IP & Log Akses Terakhir
            await sipuroDb.query(
                'UPDATE sipuro_db.customers SET last_login_ip = ?, last_login_at = NOW() WHERE customer_id = ?',
                [clientIp, user.customer_id]
            );
            await logAttempt('CUSTOMER', username, clientIp, userAgent, 'SUCCESS');

            return res.json({
                success: true,
                message: 'Login Customer berhasil',
                data: {
                    id: user.customer_id,
                    code: user.customer_code,
                    name: user.company_name,
                    role: 'CUSTOMER',
                    loginIp: clientIp
                }
            });

        } else if (role_type === 'EMPLOYEE') {
            const query = `
                SELECT employee_id, full_name, department, password, is_suspended, allowed_ip
                FROM sipuro_db.employees
                WHERE employee_id = ?
            `;
            const [rows] = await sipuroDb.query(query, [username]);

            if (rows.length === 0) {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Employee ID atau Password salah.' });
            }

            const emp = rows[0];

            if (emp.is_suspended) {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'INACTIVE');
                return res.status(401).json({ success: false, message: 'Akun Anda sedang dinonaktifkan/ditangguhkan.' });
            }

            // Validasi Pembatasan IP (Jika allowed_ip diisi)
            if (emp.allowed_ip && emp.allowed_ip !== clientIp && emp.allowed_ip !== '*') {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'IP_BLOCKED');
                return res.status(403).json({
                    success: false,
                    message: `Akses ditolak. Perangkat/IP (${clientIp}) tidak terotorisasi.`
                });
            }

            // Validasi Enkripsi / Plain Password
            const isMatch = await comparePassword(password, emp.password);
            if (!isMatch) {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Employee ID atau Password salah.' });
            }

            // Update IP & Log Akses Terakhir
            await sipuroDb.query(
                'UPDATE sipuro_db.employees SET last_login_ip = ?, last_login_at = NOW() WHERE employee_id = ?',
                [clientIp, emp.employee_id]
            );
            await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'SUCCESS');

            // Deteksi Role Superadmin (Department SUPERADMIN / ADMIN)
            const deptUpper = (emp.department || '').toUpperCase();
            const assignedRole = (deptUpper === 'SUPERADMIN' || deptUpper === 'ADMIN') ? 'SUPERADMIN' : emp.department;

            return res.json({
                success: true,
                message: 'Login Employee berhasil',
                data: {
                    id: emp.employee_id,
                    code: emp.employee_id,
                    name: emp.full_name,
                    department: emp.department,
                    role: assignedRole,
                    loginIp: clientIp
                }
            });

        } else {
            return res.status(400).json({ success: false, message: 'Role type tidak valid.' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login.', error: error.message });
    }
};

// Internal Helper untuk Log Login
async function logAttempt(userType, identifier, ip, userAgent, status) {
    try {
        await sipuroDb.query(
            `INSERT INTO sipuro_db.login_logs (user_type, user_identifier, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?)`,
            [userType, identifier, ip, userAgent, status]
        );
    } catch (err) {
        console.error('Failed logging login attempt:', err);
    }
}
