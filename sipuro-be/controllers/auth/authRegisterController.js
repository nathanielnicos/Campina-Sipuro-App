const { sipuroDb } = require('../../config/db');
const { hashPassword } = require('../../helpers/authHelper');

exports.register = async (req, res) => {
    try {
        const { user_type } = req.body;

        if (user_type === 'EMPLOYEE') {
            const { employee_code, full_name, gender, birth_date, department, password, confirm_password } = req.body;

            if (!employee_code || !full_name || !gender || !birth_date || !department || !password || !confirm_password) {
                return res.status(400).json({ success: false, message: 'All employee fields are required.' });
            }

            const cleanEmpCode = employee_code.trim();

            if (cleanEmpCode.length !== 5) {
                return res.status(400).json({ success: false, message: 'Employee Code must be exactly 5 characters.' });
            }

            if (department === 'Pilih') {
                return res.status(400).json({ success: false, message: 'Please select a valid Department.' });
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

            // Menggunakan CURDATE() langsung dari database agar konsisten dengan timezone +07:00 di db.js
            await sipuroDb.query(
                `INSERT INTO sipuro_db.employees 
                (employee_code, full_name, gender, birth_date, department, role, join_date, is_suspended, password) 
                VALUES (?, ?, ?, ?, ?, 'STAFF', CURDATE(), 1, ?)`,
                [cleanEmpCode, full_name, gender, birth_date, department, encryptedPassword]
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

            const cleanCustCode = customer_code.trim().toUpperCase();
            const cleanUserCode = customer_user_code.trim();

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ success: false, message: 'Invalid email format.' });
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
                [targetCustomer.customer_id, cleanUserCode, full_name, email, encryptedPassword]
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
