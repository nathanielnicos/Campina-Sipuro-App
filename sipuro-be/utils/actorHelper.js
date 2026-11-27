'use strict';

/**
 * Pelaku (pengguna yang sedang login) untuk aksi Production Lot.
 * Selalu dari token login; userId dari body request diabaikan.
 */

const { BusinessError } = require('./businessError');

const parseActorId = (req) => {
    const userId = Number.parseInt(req && req.user && req.user.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new BusinessError('A valid user is required. Please log in again.', 400);
    }
    return userId;
};

const assertActorExists = async (connection, userId) => {
    const [rows] = await connection.query('SELECT id FROM employees WHERE id = ? LIMIT 1', [userId]);
    if (rows.length === 0) {
        throw new BusinessError('User not found. Please log in again.', 400);
    }
};

module.exports = { parseActorId, assertActorExists };
