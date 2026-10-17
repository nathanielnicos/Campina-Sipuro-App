const { sipuroDb } = require('../../../config/db');
const { safeError } = require('../../../helpers/safeError');

/**
 * Mengubah nilai status dari request menjadi 1 / 0 secara ketat.
 * Menerima true/false, 1/0, "true"/"false", "1"/"0". Nilai lain -> null (ditolak).
 * (Sebelumnya string "false" dianggap true.)
 */
const parseFlag = (value) => {
    if (value === true || value === 1 || value === '1' || value === 'true') return 1;
    if (value === false || value === 0 || value === '0' || value === 'false') return 0;
    return null;
};

/**
 * 1. Menarik daftar karyawan dari DB (Server-side Pagination & Search)
 */
exports.getAllEmployees = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const offset = (pageNum - 1) * limitNum;

        const conditions = [];
        const queryParams = [];

        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            conditions.push('(employee_code LIKE ? OR full_name LIKE ?)');
            queryParams.push(searchTerm, searchTerm);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countQuery = `SELECT COUNT(*) AS total FROM sipuro_db.employees ${whereClause}`;
        const [countRows] = await sipuroDb.query(countQuery, queryParams);
        const totalItems = countRows[0]?.total || 0;
        const totalPages = Math.ceil(totalItems / limitNum);

        const query = `
            SELECT 
                id,
                employee_code,
                full_name,
                gender,
                department,
                birth_date,
                is_suspended
            FROM sipuro_db.employees
            ${whereClause}
            ORDER BY employee_code ASC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await sipuroDb.query(query, [...queryParams, limitNum, offset]);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                totalItems,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch employee data from the database.', error: safeError(error) });
    }
};

/**
 * 2. Toggle Status Suspend Karyawan
 */
exports.toggleEmployeeStatus = async (req, res) => {
    try {
        const targetId = Number.parseInt(req.params.id, 10);
        const { is_suspended } = req.body || {};

        if (!Number.isInteger(targetId) || targetId <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid employee id.' });
        }

        if (is_suspended === undefined) {
            return res.status(400).json({ success: false, message: 'The is_suspended status is required.' });
        }

        const suspendedFlag = parseFlag(is_suspended);
        if (suspendedFlag === null) {
            return res.status(400).json({ success: false, message: 'The is_suspended status must be true or false.' });
        }

        const [targetRows] = await sipuroDb.query(
            'SELECT id, role FROM sipuro_db.employees WHERE id = ?',
            [targetId]
        );
        if (targetRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        // Akun SUPERADMIN (termasuk akun sendiri) tidak boleh ditangguhkan agar sistem tidak terkunci
        if (suspendedFlag === 1 && (targetRows[0].role === 'SUPERADMIN' || targetId === req.user.id)) {
            return res.status(400).json({ success: false, message: 'Superadmin accounts and your own account cannot be suspended.' });
        }

        await sipuroDb.query(
            'UPDATE sipuro_db.employees SET is_suspended = ? WHERE id = ?',
            [suspendedFlag, targetId]
        );

        return res.json({
            success: true,
            message: 'Employee status updated successfully.'
        });
    } catch (error) {
        console.error('Error toggling employee status:', error);
        return res.status(500).json({ success: false, message: 'Failed to update employee status.', error: safeError(error) });
    }
};
