const { BusinessError } = require('./businessError');

/**
 * Memastikan userId berupa bilangan bulat positif dan ada di tabel employees.
 * (created_by pada po_batch_allocation_logs NOT NULL, jadi userId kosong akan membuat insert log gagal.)
 * Catatan: ini hanya memeriksa keberadaan user, bukan mengamankan identitas (tidak ada auth/JWT).
 */
const resolveValidUserId = async (queryable, rawUserId) => {
    const userId = Number.parseInt(rawUserId, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new BusinessError('A valid user is required. Please log in again.', 400);
    }

    const [rows] = await queryable.query('SELECT id FROM employees WHERE id = ? LIMIT 1', [userId]);
    if (rows.length === 0) {
        throw new BusinessError('User not found. Please log in again.', 400);
    }
    return userId;
};

module.exports = { resolveValidUserId };
