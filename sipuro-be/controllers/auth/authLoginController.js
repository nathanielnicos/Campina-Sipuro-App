const { sipuroDb } = require('../../config/db');
const { comparePassword, dummyCompare, hashPassword, isHashed, getClientIp } = require('../../helpers/authHelper');
const { signToken } = require('../../helpers/tokenHelper');
const { safeError } = require('../../helpers/safeError');

// Pembatasan percobaan login: 5 kali gagal dalam 15 menit per kombinasi (jenis user + username + IP)
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_WINDOW_SECONDS = 15 * 60;
const MAX_USERNAME_LENGTH = 50;

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

/**
 * Memeriksa apakah kombinasi user + IP sedang terkunci.
 * Terkunci jika ada >= 5 percobaan FAILED_PASSWORD dalam 15 menit terakhir
 * (dihitung sejak login sukses terakhir). Semua waktu dihitung oleh database.
 * @returns {Promise<{locked: boolean, retryAfterSeconds: number}>}
 */
async function getLockStatus(userType, identifier, ip) {
    const [rows] = await sipuroDb.query(
        `SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age_seconds
         FROM sipuro_db.login_logs
         WHERE user_type = ? AND user_identifier = ? AND ip_address = ?
           AND status = 'FAILED_PASSWORD'
           AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
           AND created_at > COALESCE((
                SELECT MAX(l2.created_at) FROM sipuro_db.login_logs l2
                WHERE l2.user_type = ? AND l2.user_identifier = ? AND l2.ip_address = ? AND l2.status = 'SUCCESS'
           ), '1970-01-01')
         ORDER BY created_at DESC, log_id DESC
         LIMIT ?`,
        [userType, identifier, ip, LOCK_WINDOW_SECONDS, userType, identifier, ip, MAX_FAILED_ATTEMPTS]
    );

    if (rows.length >= MAX_FAILED_ATTEMPTS) {
        const oldestCounted = Number(rows[MAX_FAILED_ATTEMPTS - 1].age_seconds) || 0;
        return { locked: true, retryAfterSeconds: Math.max(1, LOCK_WINDOW_SECONDS - oldestCounted) };
    }
    return { locked: false, retryAfterSeconds: 0 };
}

/**
 * Password plain-text lama otomatis di-hash setelah login berhasil.
 * Kegagalan di sini tidak boleh menggagalkan login.
 */
async function upgradePlainPassword(table, idColumn, id, storedPassword, plainPassword) {
    if (isHashed(storedPassword) || plainPassword.length > 72) return;
    try {
        const hashed = await hashPassword(plainPassword);
        await sipuroDb.query(`UPDATE sipuro_db.${table} SET password = ? WHERE ${idColumn} = ?`, [hashed, id]);
    } catch (err) {
        console.error('Failed upgrading plain-text password to hash:', err);
    }
}

async function loginCustomer({ cleanUsername, password, clientIp, userAgent, res }) {
    // Query Case-Sensitive (BINARY) + Alias khusus company_is_active
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
    const user = rows[0];

    // Password diperiksa LEBIH DULU, agar status akun / IP tidak bocor ke pihak yang tidak tahu password
    if (!user) {
        await dummyCompare(password);
        await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'FAILED_PASSWORD');
        return res.status(401).json({ success: false, message: 'Invalid Customer Username or Password.' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
        await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'FAILED_PASSWORD');
        return res.status(401).json({ success: false, message: 'Invalid Customer Username or Password.' });
    }

    // Validasi Status Akun User Customer
    if (!user.is_active) {
        await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'INACTIVE');
        return res.status(401).json({ success: false, message: 'Your user account is inactive. Please contact administrator.' });
    }

    // Validasi Status Akun Perusahaan/Tenant Customer
    if (!user.company_is_active) {
        await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'INACTIVE');
        return res.status(401).json({ success: false, message: 'Your company account is inactive. Access denied.' });
    }

    // Validasi Allowed IP
    if (user.allowed_ip && user.allowed_ip !== clientIp && user.allowed_ip !== '*') {
        await logAttempt('CUSTOMER', cleanUsername, clientIp, userAgent, 'IP_BLOCKED');
        return res.status(403).json({
            success: false,
            message: `Access denied. Device/IP (${clientIp}) is not registered for this account.`
        });
    }

    await upgradePlainPassword('customer_users', 'customer_user_id', user.customer_user_id, user.password, password);

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
        token: signToken({ id: user.customer_user_id, type: 'CUSTOMER' }),
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
}

async function loginEmployee({ cleanUsername, password, clientIp, userAgent, res }) {
    // Query Case-Sensitive (BINARY)
    const query = `
        SELECT id, employee_code, full_name, department, role, password, is_suspended, allowed_ip
        FROM sipuro_db.employees
        WHERE BINARY employee_code = ?
    `;
    const [rows] = await sipuroDb.query(query, [cleanUsername]);
    const emp = rows[0];

    if (!emp) {
        await dummyCompare(password);
        await logAttempt('EMPLOYEE', cleanUsername, clientIp, userAgent, 'FAILED_PASSWORD');
        return res.status(401).json({ success: false, message: 'Invalid Employee Code or Password.' });
    }

    const isMatch = await comparePassword(password, emp.password);
    if (!isMatch) {
        await logAttempt('EMPLOYEE', cleanUsername, clientIp, userAgent, 'FAILED_PASSWORD');
        return res.status(401).json({ success: false, message: 'Invalid Employee Code or Password.' });
    }

    // Validasi Status Employee (is_suspended)
    if (emp.is_suspended) {
        await logAttempt('EMPLOYEE', cleanUsername, clientIp, userAgent, 'INACTIVE');
        return res.status(401).json({ success: false, message: 'Your account is suspended or pending approval by Superadmin.' });
    }

    // Validasi Allowed IP
    if (emp.allowed_ip && emp.allowed_ip !== clientIp && emp.allowed_ip !== '*') {
        await logAttempt('EMPLOYEE', cleanUsername, clientIp, userAgent, 'IP_BLOCKED');
        return res.status(403).json({
            success: false,
            message: `Access denied. Device/IP (${clientIp}) is unauthorized.`
        });
    }

    await upgradePlainPassword('employees', 'id', emp.id, emp.password, password);

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
        token: signToken({ id: emp.id, type: 'EMPLOYEE' }),
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
}

exports.login = async (req, res) => {
    try {
        const { username, password, role_type } = req.body || {};
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';

        // 1. Validasi Mandatory Fields
        if (typeof username !== 'string' || typeof password !== 'string' || typeof role_type !== 'string'
            || !username.trim() || !password || !role_type) {
            return res.status(400).json({
                success: false,
                message: 'Username/Code, Password, and Role Type are required.'
            });
        }

        if (role_type !== 'CUSTOMER' && role_type !== 'EMPLOYEE') {
            return res.status(400).json({ success: false, message: 'Invalid role type.' });
        }

        const cleanUsername = username.trim();
        if (cleanUsername.length > MAX_USERNAME_LENGTH) {
            return res.status(400).json({ success: false, message: 'Username/Code is too long.' });
        }

        // 2. Pembatasan percobaan login (dicek sebelum password diperiksa)
        const lock = await getLockStatus(role_type, cleanUsername, clientIp);
        if (lock.locked) {
            const minutes = Math.ceil(lock.retryAfterSeconds / 60);
            res.set('Retry-After', String(lock.retryAfterSeconds));
            return res.status(429).json({
                success: false,
                message: `Too many failed login attempts. Please try again in ${minutes} minute(s).`,
                retry_after_seconds: lock.retryAfterSeconds
            });
        }

        const ctx = { cleanUsername, password, clientIp, userAgent, res };
        return role_type === 'CUSTOMER' ? await loginCustomer(ctx) : await loginEmployee(ctx);
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ success: false, message: 'An error occurred on the server during login.', error: safeError(error) });
    }
};
