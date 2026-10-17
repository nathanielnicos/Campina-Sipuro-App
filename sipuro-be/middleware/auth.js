const { sipuroDb } = require('../config/db');
const { verifyToken } = require('../helpers/tokenHelper');

const normalize = (value) => String(value || '').trim().toUpperCase();

/**
 * Membaca ulang akun dari database pada SETIAP request, sehingga akun yang dinonaktifkan
 * atau diubah perannya langsung berlaku tanpa menunggu token kedaluwarsa.
 * @returns {Promise<object|null>} null jika akun tidak ada / tidak aktif
 */
const loadUser = async (type, id) => {
    const userId = Number.parseInt(id, 10);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    if (type === 'CUSTOMER') {
        const [rows] = await sipuroDb.query(
            `SELECT cu.customer_user_id, cu.customer_user_code, cu.full_name, cu.customer_id,
                    cu.is_active, c.customer_code, c.company_name, c.is_active AS company_is_active
             FROM sipuro_db.customer_users cu
             JOIN sipuro_db.customers c ON cu.customer_id = c.customer_id
             WHERE cu.customer_user_id = ?`,
            [userId]
        );
        const row = rows[0];
        if (!row || !row.is_active || !row.company_is_active) return null;

        return {
            id: row.customer_user_id,
            type: 'CUSTOMER',
            code: row.customer_user_code,
            name: row.full_name,
            role: 'CUSTOMER',
            department: null,
            customerId: row.customer_id,
            customerCode: row.customer_code,
            companyName: row.company_name
        };
    }

    if (type === 'EMPLOYEE') {
        const [rows] = await sipuroDb.query(
            `SELECT id, employee_code, full_name, department, role, is_suspended
             FROM sipuro_db.employees WHERE id = ?`,
            [userId]
        );
        const row = rows[0];
        if (!row || row.is_suspended) return null;

        return {
            id: row.id,
            type: 'EMPLOYEE',
            code: row.employee_code,
            name: row.full_name,
            role: row.role,
            department: row.department,
            customerId: null,
            customerCode: null,
            companyName: null
        };
    }

    return null;
};

/**
 * Cek akses berdasarkan "kelompok" pengguna sesuai matriks akses:
 *  CUSTOMER   : akun customer
 *  SUPERADMIN : karyawan dengan role SUPERADMIN
 *  PPIC       : karyawan departemen PPIC (STAFF / MANAGER)
 *  LOGISTIC   : karyawan departemen LOGISTIC / LOGISTICS (STAFF / MANAGER)
 *  FINANCE    : karyawan departemen FINANCE (STAFF / MANAGER)
 */
const hasAccess = (user, group) => {
    if (!user) return false;
    const dept = normalize(user.department);
    const isStaffOrManager = user.role === 'STAFF' || user.role === 'MANAGER';

    switch (group) {
        case 'CUSTOMER': return user.type === 'CUSTOMER';
        case 'SUPERADMIN': return user.type === 'EMPLOYEE' && user.role === 'SUPERADMIN';
        case 'PPIC': return user.type === 'EMPLOYEE' && isStaffOrManager && dept === 'PPIC';
        case 'LOGISTIC': return user.type === 'EMPLOYEE' && isStaffOrManager && (dept === 'LOGISTIC' || dept === 'LOGISTICS');
        case 'FINANCE': return user.type === 'EMPLOYEE' && isStaffOrManager && dept === 'FINANCE';
        default: return false;
    }
};

/**
 * Middleware wajib login. Mengisi req.user.
 */
const requireAuth = async (req, res, next) => {
    try {
        const header = req.headers.authorization || '';
        const [scheme, token] = header.split(' ');

        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required. Please log in.' });
        }

        let payload;
        try {
            payload = verifyToken(token);
        } catch (err) {
            const expired = err && err.name === 'TokenExpiredError';
            return res.status(401).json({
                success: false,
                code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
                message: expired ? 'Your session has expired. Please log in again.' : 'Invalid session. Please log in again.'
            });
        }

        const user = await loadUser(payload.type, payload.sub);
        if (!user) {
            return res.status(401).json({
                success: false,
                code: 'ACCOUNT_UNAVAILABLE',
                message: 'Your account is no longer active. Please log in again.'
            });
        }

        req.user = user;
        return next();
    } catch (error) {
        console.error('Error in requireAuth:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify authentication.' });
    }
};

/**
 * Middleware pembatas akses. Lolos jika user termasuk SALAH SATU kelompok yang disebut.
 * Contoh: requireAccess('PPIC', 'SUPERADMIN')
 * Harus dipasang setelah requireAuth.
 */
const requireAccess = (...groups) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required. Please log in.' });
    }
    if (groups.some((group) => hasAccess(req.user, group))) {
        return next();
    }
    return res.status(403).json({ success: false, message: 'You do not have permission to access this resource.' });
};

module.exports = { requireAuth, requireAccess, hasAccess };
