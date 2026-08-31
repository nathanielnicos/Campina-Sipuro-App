const { sipuroDb } = require('../config/db');
const { comparePassword, hashPassword, getClientIp } = require('../helpers/authHelper');

/**
 * Login Controller (Customer & Employee)
 */
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

            // Validasi status akun (Must active / 1)
            if (!user.is_active) {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'INACTIVE');
                return res.status(401).json({ success: false, message: 'Akun Anda tidak aktif / menunggu persetujuan Superadmin.' });
            }

            if (user.allowed_ip && user.allowed_ip !== clientIp && user.allowed_ip !== '*') {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'IP_BLOCKED');
                return res.status(403).json({
                    success: false,
                    message: `Akses ditolak. Perangkat/IP (${clientIp}) tidak terdaftar untuk akun ini.`
                });
            }

            const isMatch = await comparePassword(password, user.password);
            if (!isMatch) {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Kode Customer atau Password salah.' });
            }

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
                SELECT id, employee_code, full_name, department, password, is_suspended, allowed_ip
                FROM sipuro_db.employees
                WHERE employee_code = ?
            `;
            const [rows] = await sipuroDb.query(query, [username]);

            if (rows.length === 0) {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Kode Karyawan atau Password salah.' });
            }

            const emp = rows[0];

            // Validasi status akun (Must not suspended / 0)
            if (emp.is_suspended) {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'INACTIVE');
                return res.status(401).json({ success: false, message: 'Akun Anda sedang ditangguhkan / belum dikonfirmasi Superadmin.' });
            }

            if (emp.allowed_ip && emp.allowed_ip !== clientIp && emp.allowed_ip !== '*') {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'IP_BLOCKED');
                return res.status(403).json({
                    success: false,
                    message: `Akses ditolak. Perangkat/IP (${clientIp}) tidak terotorisasi.`
                });
            }

            const isMatch = await comparePassword(password, emp.password);
            if (!isMatch) {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Kode Karyawan atau Password salah.' });
            }

            await sipuroDb.query(
                'UPDATE sipuro_db.employees SET last_login_ip = ?, last_login_at = NOW() WHERE id = ?',
                [clientIp, emp.id]
            );
            await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'SUCCESS');

            const deptUpper = (emp.department || '').toUpperCase();
            const assignedRole = (deptUpper === 'SUPERADMIN' || deptUpper === 'ADMIN') ? 'SUPERADMIN' : emp.department;

            return res.json({
                success: true,
                message: 'Login Employee berhasil',
                data: {
                    id: emp.id,
                    code: emp.employee_code,
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

/**
 * Register Controller (Customer & Employee)
 */
exports.register = async (req, res) => {
    try {
        const { user_type } = req.body;

        if (user_type === 'EMPLOYEE') {
            const { employee_code, full_name, gender, birth_date, department, password, confirm_password } = req.body;

            if (!employee_code || !full_name || !gender || !birth_date || !department || !password || !confirm_password) {
                return res.status(400).json({ success: false, message: 'Semua field karyawan wajib diisi.' });
            }

            if (department === 'Pilih') {
                return res.status(400).json({ success: false, message: 'Silakan pilih Departemen yang valid.' });
            }

            if (password !== confirm_password) {
                return res.status(400).json({ success: false, message: 'Konfirmasi password tidak cocok.' });
            }

            // Cek Duplikasi Kode Karyawan
            const [existCode] = await sipuroDb.query('SELECT id FROM sipuro_db.employees WHERE employee_code = ?', [employee_code]);
            if (existCode.length > 0) {
                return res.status(400).json({ success: false, message: 'Kode Karyawan sudah terdaftar.' });
            }

            const encryptedPassword = await hashPassword(password);
            const today = new Date().toISOString().split('T')[0];

            // Karyawan baru didaftarkan dengan is_suspended = 1 (true)
            await sipuroDb.query(
                `INSERT INTO sipuro_db.employees 
                (employee_code, full_name, gender, birth_date, department, join_date, is_suspended, password) 
                VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
                [employee_code, full_name, gender, birth_date, department, today, encryptedPassword]
            );

            return res.status(201).json({
                success: true,
                message: 'Pendaftaran karyawan berhasil. Akun memerlukan konfirmasi dari Superadmin untuk aktif.'
            });

        } else if (user_type === 'CUSTOMER') {
            const { customer_code, company_name, email, phone, address, delivery_address, password, confirm_password } = req.body;

            if (!customer_code || !company_name || !email || !phone || !address || !delivery_address || !password || !confirm_password) {
                return res.status(400).json({ success: false, message: 'Semua field customer wajib diisi.' });
            }

            const codeUpper = customer_code.toUpperCase();
            if (!/^[A-Z0-9]{3,4}$/.test(codeUpper)) {
                return res.status(400).json({ success: false, message: 'Kode Pelanggan harus huruf kapital dan berpanjang 3 sampai 4 karakter ALFANUMERIK.' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
            }

            if (password !== confirm_password) {
                return res.status(400).json({ success: false, message: 'Konfirmasi password tidak cocok.' });
            }

            const [existCust] = await sipuroDb.query('SELECT customer_id FROM sipuro_db.customers WHERE customer_code = ?', [codeUpper]);
            if (existCust.length > 0) {
                return res.status(400).json({ success: false, message: 'Kode Customer sudah digunakan.' });
            }

            const encryptedPassword = await hashPassword(password);
            const fullPhone = phone.startsWith('+62') ? phone : `+62${phone.replace(/^0+/, '')}`;

            // Customer baru didaftarkan dengan is_active = 0 (false)
            await sipuroDb.query(
                `INSERT INTO sipuro_db.customers 
                (customer_code, company_name, email, phone, address, delivery_address, is_active, password) 
                VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
                [codeUpper, company_name, email, fullPhone, address, delivery_address, encryptedPassword]
            );

            return res.status(201).json({
                success: true,
                message: 'Pendaftaran pelanggan berhasil. Akun Anda memerlukan konfirmasi dari Superadmin sebelum dapat digunakan.'
            });

        } else {
            return res.status(400).json({ success: false, message: 'Tipe pendaftaran tidak valid.' });
        }
    } catch (error) {
        console.error('Error during registration:', error);
        return res.status(500).json({ success: false, message: 'Gagal melakukan pendaftaran.', error: error.message });
    }
};

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
