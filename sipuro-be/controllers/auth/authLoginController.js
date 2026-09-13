const { sipuroDb } = require('../../config/db');
const { comparePassword, getClientIp } = require('../../helpers/authHelper');

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

exports.login = async (req, res) => {
    try {
        const { username, password, role_type } = req.body;
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        // 1. Validasi Mandatory Fields
        if (!username || !password || !role_type) {
            return res.status(400).json({
                success: false,
                message: 'Username/Code, Password, and Role Type are required.'
            });
        }

        const cleanUsername = username.trim();

        // --- HANDLER CUSTOMER ---
        if (role_type === 'CUSTOMER') {
            // 2. Query Case-Sensitive (BINARY) + Alias khusus company_is_active
            const query = `
                SELECT 
                    cu.customer_user_id, 
                    cu.customer_user_code, 
                    cu.customer_id, 
                    cu.full_name, 
                    cu.email, 
                    cu.password, 
                    cu.is_active, 
                    cu.allowed_ip,
                    c.customer_code, 
                    c.company_name, 
                    c.is_active AS company_is_active
                FROM sipuro_db.customer_users cu
                JOIN sipuro_db.customers c ON cu.customer_id = c.customer_id
                WHERE BINARY cu.customer_user_code = ?
            `;
            const [rows] = await sipuroDb.query(query, [cleanUsername]);

            if (rows.length === 0) {
                await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Invalid Customer Username or Password.' });
            }

            const user = rows[0];

            // 3. Validasi Status Akun User Customer
            if (!user.is_active) {
                await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'INACTIVE');
                return res.status(401).json({ success: false, message: 'Your user account is inactive. Please contact administrator.' });
            }

            // 4. Validasi Status Akun Perusahaan/Tenant Customer
            if (!user.company_is_active) {
                await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'INACTIVE');
                return res.status(401).json({ success: false, message: 'Your company account is inactive. Access denied.' });
            }

            // 5. Validasi Allowed IP
            if (user.allowed_ip && user.allowed_ip !== clientIp && user.allowed_ip !== '*') {
                await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'IP_BLOCKED');
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Device/IP (${clientIp}) is not registered for this account.`
                });
            }

            // 6. Validasi Password
            const isMatch = await comparePassword(password, user.password);
            if (!isMatch) {
                await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Invalid Customer Username or Password.' });
            }

            // Update Log Login Sukses
            await sipuroDb.query(
                'UPDATE sipuro_db.customer_users SET last_login_ip = ?, last_login_at = NOW() WHERE customer_user_id = ?',
                [clientIp, user.customer_user_id]
            );
            await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'SUCCESS');

            // Seragamkan Struktur JSON Output
            return res.json({
                success: true,
                message: 'Customer login successful.',
                data: {
                    id: user.customer_user_id,
                    code: user.customer_user_code,
                    name: user.full_name,
                    email: user.email,
                    role: 'CUSTOMER',
                    department: null,
                    customer_id: user.customer_id,
                    customer_code: user.customer_code,
                    company_name: user.company_name,
                    loginIp: clientIp
                }
            });

            // --- HANDLER EMPLOYEE ---
        } else if (role_type === 'EMPLOYEE') {
            // 2. Query Case-Sensitive (BINARY)
            const query = `
                SELECT id, employee_code, full_name, department, role, password, is_suspended, allowed_ip
                FROM sipuro_db.employees
                WHERE BINARY employee_code = ?
            `;
            const [rows] = await sipuroDb.query(query, [cleanUsername]);

            if (rows.length === 0) {
                await logAttempt('EMPLOYEE', cleanUsername, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Invalid Employee Code or Password.' });
            }

            const emp = rows[0];

            // 3. Validasi Status Employee (is_suspended)
            if (emp.is_suspended) {
                await logAttempt('EMPLOYEE', cleanUsername, clientIp, userAgent, 'INACTIVE');
                return res.status(401).json({ success: false, message: 'Your account is suspended or pending approval by Superadmin.' });
            }

            // 4. Validasi Allowed IP
            if (emp.allowed_ip && emp.allowed_ip !== clientIp && emp.allowed_ip !== '*') {
                await logAttempt('EMPLOYEE', cleanUsername, clientIp, userAgent, 'IP_BLOCKED');
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Device/IP (${clientIp}) is unauthorized.`
                });
            }

            // 5. Validasi Password
            const isMatch = await comparePassword(password, emp.password);
            if (!isMatch) {
                await logAttempt('EMPLOYEE', cleanUsername, clientIp, userAgent, 'FAILED_PASSWORD');
                return res.status(401).json({ success: false, message: 'Invalid Employee Code or Password.' });
            }

            // Update Log Login Sukses
            await sipuroDb.query(
                'UPDATE sipuro_db.employees SET last_login_ip = ?, last_login_at = NOW() WHERE id = ?',
                [clientIp, emp.id]
            );
            await logAttempt('EMPLOYEE', cleanUsername, clientIp, userAgent, 'SUCCESS');

            // Seragamkan Struktur JSON Output
            return res.json({
                success: true,
                message: 'Employee login successful.',
                data: {
                    id: emp.id,
                    code: emp.employee_code,
                    name: emp.full_name,
                    email: null,
                    role: emp.role,
                    department: emp.department,
                    customer_id: null,
                    customer_code: null,
                    company_name: null,
                    loginIp: clientIp
                }
            });

        } else {
            return res.status(400).json({ success: false, message: 'Invalid role type.' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ success: false, message: 'An error occurred on the server during login.', error: error.message });
    }
};
