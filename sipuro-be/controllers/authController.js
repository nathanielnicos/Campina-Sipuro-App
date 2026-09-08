const { sipuroDb } = require('../config/db');
const { comparePassword, hashPassword, getClientIp } = require('../helpers/authHelper');

/**
 * Login Controller (Customer User & Employee)
 */
exports.login = async (req, res) => {
    try {
        const { username, password, role_type } = req.body;
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        if (!username || !password || !role_type) {
            return res.status(400).json({
                success: false,
                message: 'Username/Code, Password, and Role Type are required.'
            });
        }

        if (role_type === 'CUSTOMER') {
            // Join customer_users dengan customers untuk verifikasi akun user dan status tenant
            const query = `
                SELECT 
                    cu.customer_user_id, 
                    cu.customer_user_code, 
                    cu.customer_id, 
                    cu.full_name, 
                    cu.email, 
                    cu.password, 
                    cu.is_active AS user_is_active, 
                    cu.allowed_ip,
                    c.customer_code, 
                    c.company_name, 
                    c.is_active AS tenant_is_active
                FROM sipuro_db.customer_users cu
                JOIN sipuro_db.customers c ON cu.customer_id = c.customer_id
                WHERE cu.customer_user_code = ?
            `;
            const [rows] = await sipuroDb.query(query, [username]);

            if (rows.length === 0) {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Invalid Customer User Code or Password.' });
            }

            const user = rows[0];

            // Validasi status tenant (Perusahaan)
            if (!user.tenant_is_active) {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'INACTIVE');
                return res.status(401).json({ success: false, message: 'Your company account is inactive or pending approval by Superadmin.' });
            }

            // Validasi status akun user individu
            if (!user.user_is_active) {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'INACTIVE');
                return res.status(401).json({ success: false, message: 'Your user account is inactive. Please contact your company administrator.' });
            }

            // Validasi IP Whitelist
            if (user.allowed_ip && user.allowed_ip !== clientIp && user.allowed_ip !== '*') {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'IP_BLOCKED');
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Device/IP (${clientIp}) is not registered for this account.`
                });
            }

            // Validasi Password
            const isMatch = await comparePassword(password, user.password);
            if (!isMatch) {
                await logAttempt('CUSTOMER', username, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Invalid Customer User Code or Password.' });
            }

            // Update log login pada customer_users
            await sipuroDb.query(
                'UPDATE sipuro_db.customer_users SET last_login_ip = ?, last_login_at = NOW() WHERE customer_user_id = ?',
                [clientIp, user.customer_user_id]
            );
            await logAttempt('CUSTOMER', username, clientIp, userAgent, 'SUCCESS');

            return res.json({
                success: true,
                message: 'Customer login successful.',
                data: {
                    user_id: user.customer_user_id,
                    user_code: user.customer_user_code,
                    full_name: user.full_name,
                    customer_id: user.customer_id,
                    customer_code: user.customer_code,
                    company_name: user.company_name,
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
                return res.status(401).json({ success: false, message: 'Invalid Employee Code or Password.' });
            }

            const emp = rows[0];

            // Validasi status akun (is_suspended must be 0)
            if (emp.is_suspended) {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'INACTIVE');
                return res.status(401).json({ success: false, message: 'Your account is suspended or pending approval by Superadmin.' });
            }

            // Validasi IP Whitelist
            if (emp.allowed_ip && emp.allowed_ip !== clientIp && emp.allowed_ip !== '*') {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'IP_BLOCKED');
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Device/IP (${clientIp}) is unauthorized.`
                });
            }

            // Validasi Password
            const isMatch = await comparePassword(password, emp.password);
            if (!isMatch) {
                await logAttempt('EMPLOYEE', username, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Invalid Employee Code or Password.' });
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
                message: 'Employee login successful.',
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
            return res.status(400).json({ success: false, message: 'Invalid role type.' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, message: 'An error occurred on the server during login.', error: error.message });
    }
};

/**
 * Register Controller (Customer User & Employee)
 */
exports.register = async (req, res) => {
    try {
        const { user_type } = req.body;

        if (user_type === 'EMPLOYEE') {
            const { employee_code, full_name, gender, birth_date, department, password, confirm_password } = req.body;

            if (!employee_code || !full_name || !gender || !birth_date || !department || !password || !confirm_password) {
                return res.status(400).json({ success: false, message: 'All employee fields are required.' });
            }

            // Validasi employee_code wajib 5 karakter
            if (employee_code.trim().length !== 5) {
                return res.status(400).json({ success: false, message: 'Employee Code must be exactly 5 characters.' });
            }

            if (department === 'Pilih') {
                return res.status(400).json({ success: false, message: 'Please select a valid Department.' });
            }

            if (password !== confirm_password) {
                return res.status(400).json({ success: false, message: 'Password confirmation does not match.' });
            }

            // Cek Duplikasi Kode Karyawan
            const [existCode] = await sipuroDb.query('SELECT id FROM sipuro_db.employees WHERE employee_code = ?', [employee_code.trim()]);
            if (existCode.length > 0) {
                return res.status(400).json({ success: false, message: 'Employee Code is already registered.' });
            }

            const encryptedPassword = await hashPassword(password);
            const today = new Date().toISOString().split('T')[0];

            // Set is_suspended = 1 (membutuhkan aktivasi/approval admin)
            await sipuroDb.query(
                `INSERT INTO sipuro_db.employees 
                (employee_code, full_name, gender, birth_date, department, join_date, is_suspended, password) 
                VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
                [employee_code.trim(), full_name, gender, birth_date, department, today, encryptedPassword]
            );

            return res.status(201).json({
                success: true,
                message: 'Employee registration successful. Account requires approval from Superadmin.'
            });

        } else if (user_type === 'CUSTOMER') {
            const { customer_code, customer_user_code, full_name, email, password, confirm_password } = req.body;

            if (!customer_code || !customer_user_code || !full_name || !email || !password || !confirm_password) {
                return res.status(400).json({ success: false, message: 'All fields are required.' });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ success: false, message: 'Invalid email format.' });
            }

            if (password !== confirm_password) {
                return res.status(400).json({ success: false, message: 'Password confirmation does not match.' });
            }

            // 1. Verifikasi keberadaan tenant (Customer) berdasarkan customer_code
            const [custRows] = await sipuroDb.query(
                'SELECT customer_id, is_active FROM sipuro_db.customers WHERE customer_code = ?',
                [customer_code.trim().toUpperCase()]
            );

            if (custRows.length === 0) {
                return res.status(404).json({ success: false, message: 'Customer Code not found. Registration denied.' });
            }

            const targetCustomer = custRows[0];

            // 2. Cek duplikasi customer_user_code
            const [existUserCode] = await sipuroDb.query(
                'SELECT customer_user_id FROM sipuro_db.customer_users WHERE customer_user_code = ?',
                [customer_user_code.trim()]
            );
            if (existUserCode.length > 0) {
                return res.status(400).json({ success: false, message: 'User Code is already taken.' });
            }

            const encryptedPassword = await hashPassword(password);

            // 3. Simpan data user baru terikat pada customer_id tenant (Set is_active = 0)
            await sipuroDb.query(
                `INSERT INTO sipuro_db.customer_users 
                (customer_id, customer_user_code, full_name, email, password, is_active) 
                VALUES (?, ?, ?, ?, ?, 0)`,
                [targetCustomer.customer_id, customer_user_code.trim(), full_name, email, encryptedPassword]
            );

            return res.status(201).json({
                success: true,
                message: 'Customer User registration successful. Account pending activation by administrator.'
            });

        } else {
            return res.status(400).json({ success: false, message: 'Invalid registration type.' });
        }
    } catch (error) {
        console.error('Error during registration:', error);
        return res.status(500).json({ success: false, message: 'Registration failed.', error: error.message });
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
