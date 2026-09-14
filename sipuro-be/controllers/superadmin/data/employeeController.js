const { sipuroDb } = require('../../../config/db');

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
        return res.status(500).json({ success: false, message: 'Failed to fetch employee data from the database.', error: error.message });
    }
};

/**
 * 2. Toggle Status Suspend Karyawan
 */
exports.toggleEmployeeStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_suspended } = req.body;

        if (is_suspended === undefined) {
            return res.status(400).json({ success: false, message: 'The is_suspended status is required.' });
        }

        await sipuroDb.query(
            'UPDATE sipuro_db.employees SET is_suspended = ? WHERE id = ?',
            [is_suspended ? 1 : 0, id]
        );

        return res.json({
            success: true,
            message: 'Employee status updated successfully.'
        });
    } catch (error) {
        console.error('Error toggling employee status:', error);
        return res.status(500).json({ success: false, message: 'Failed to update employee status.', error: error.message });
    }
};
