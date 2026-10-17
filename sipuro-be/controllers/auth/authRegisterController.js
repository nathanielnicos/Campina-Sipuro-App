const { sipuroDb } = require('../../config/db');
const { hashPassword, validateNewPassword } = require('../../helpers/authHelper');
const { safeError } = require('../../helpers/safeError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Batas panjang mengikuti lebar kolom di database
const LIMITS = {
    employeeFullName: 100,
    employeeEmail: 255,
    department: 100,
    customerFullName: 100,
    customerEmail: 100,
    code: 50
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

// Tanggal YYYY-MM-DD yang benar-benar ada di kalender dan tidak di masa depan
const isValidPastDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
    return dt.getTime() <= Date.now() && y >= 1900;
};

exports.register = async (req, res) => {
    try {
        const { user_type } = req.body || {};

        if (user_type === 'EMPLOYEE') {
            const { employee_code, full_name, email, gender, birth_date, department, password, confirm_password } = req.body;

            if (![employee_code, full_name, email, gender, birth_date, department, password, confirm_password].every(isNonEmptyString)) {
                return res.status(400).json({ success: false, message: 'All employee fields are required.' });
            }

            const cleanEmpCode = employee_code.trim();
            const cleanFullName = full_name.trim();
            const cleanEmail = email.trim();
            const cleanDepartment = department.trim();

            if (cleanEmpCode.length !== 5) {
                return res.status(400).json({ success: false, message: 'Employee Code must be exactly 5 characters.' });
            }

            if (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > LIMITS.employeeEmail) {
                return res.status(400).json({ success: false, message: 'Invalid email format.' });
            }

            if (cleanFullName.length > LIMITS.employeeFullName) {
                return res.status(400).json({ success: false, message: `Full name must not exceed ${LIMITS.employeeFullName} characters.` });
            }

            if (cleanDepartment === 'Pilih' || cleanDepartment.length > LIMITS.department) {
                return res.status(400).json({ success: false, message: 'Please select a valid Department.' });
            }

            if (gender !== 'M' && gender !== 'F') {
                return res.status(400).json({ success: false, message: 'Please select a valid gender.' });
            }

            if (!isValidPastDate(birth_date)) {
                return res.status(400).json({ success: false, message: 'Invalid birth date.' });
            }

            const passwordError = validateNewPassword(password);
            if (passwordError) {
                return res.status(400).json({ success: false, message: passwordError });
            }

            if (password !== confirm_password) {
                return res.status(400).json({ success: false, message: 'Password confirmation does not match.' });
            }

            const [existCode] = await sipuroDb.query(
                'SELECT id FROM sipuro_db.employees WHERE employee_code = ?',
                [cleanEmpCode]
            );
            if (existCode.length > 0) {
                return res.status(400).json({ success: false, message: 'Employee Code is already registered.' });
            }

            const encryptedPassword = await hashPassword(password);

            // Akun baru selalu STAFF dan ditangguhkan (is_suspended = 1) sampai disetujui Superadmin
            await sipuroDb.query(
                `INSERT INTO sipuro_db.employees 
                (employee_code, full_name, email, gender, birth_date, department, role, join_date, is_suspended, password) 
                VALUES (?, ?, ?, ?, ?, ?, 'STAFF', CURDATE(), 1, ?)`,
                [cleanEmpCode, cleanFullName, cleanEmail, gender, birth_date, cleanDepartment, encryptedPassword]
            );

            return res.status(201).json({
                success: true,
                message: 'Employee registration successful. Account requires approval from Superadmin.'
            });

        } else if (user_type === 'CUSTOMER') {
            const { customer_code, customer_user_code, full_name, email, password, confirm_password } = req.body;

            if (![customer_code, customer_user_code, full_name, email, password, confirm_password].every(isNonEmptyString)) {
                return res.status(400).json({ success: false, message: 'All fields are required.' });
            }

            const cleanCustCode = customer_code.trim().toUpperCase();
            const cleanUserCode = customer_user_code.trim();
            const cleanFullName = full_name.trim();
            const cleanEmail = email.trim();

            if (cleanCustCode.length > LIMITS.code || cleanUserCode.length > LIMITS.code) {
                return res.status(400).json({ success: false, message: `Codes must not exceed ${LIMITS.code} characters.` });
            }

            if (cleanFullName.length > LIMITS.customerFullName) {
                return res.status(400).json({ success: false, message: `Full name must not exceed ${LIMITS.customerFullName} characters.` });
            }

            if (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > LIMITS.customerEmail) {
                return res.status(400).json({ success: false, message: 'Invalid email format.' });
            }

            const passwordError = validateNewPassword(password);
            if (passwordError) {
                return res.status(400).json({ success: false, message: passwordError });
            }

            if (password !== confirm_password) {
                return res.status(400).json({ success: false, message: 'Password confirmation does not match.' });
            }

            // Validasi keberadaan dan keaktifan akun Perusahaan / Customer
            const [custRows] = await sipuroDb.query(
                'SELECT customer_id, is_active FROM sipuro_db.customers WHERE customer_code = ?',
                [cleanCustCode]
            );

            if (custRows.length === 0) {
                return res.status(404).json({ success: false, message: 'Customer Code not found. Registration denied.' });
            }

            const targetCustomer = custRows[0];

            if (!targetCustomer.is_active) {
                return res.status(403).json({ success: false, message: 'Customer company account is inactive. Registration denied.' });
            }

            // Pengecekan apakah Username Customer User sudah terpakai
            const [existUserCode] = await sipuroDb.query(
                'SELECT customer_user_id FROM sipuro_db.customer_users WHERE customer_user_code = ?',
                [cleanUserCode]
            );
            if (existUserCode.length > 0) {
                return res.status(400).json({ success: false, message: 'Username is already taken.' });
            }

            const encryptedPassword = await hashPassword(password);

            await sipuroDb.query(
                `INSERT INTO sipuro_db.customer_users 
                (customer_id, customer_user_code, full_name, email, password, is_active) 
                VALUES (?, ?, ?, ?, ?, 0)`,
                [targetCustomer.customer_id, cleanUserCode, cleanFullName, cleanEmail, encryptedPassword]
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
        return res.status(500).json({ success: false, message: 'Registration failed.', error: safeError(error) });
    }
};
