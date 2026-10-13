const { BusinessError } = require('../businessError');

/**
 * MySQL advisory lock so that commits of the same feature run one at a time
 * (also across serverless instances). Same approach as the production upload.
 */
const acquireCommitLock = async (connection, lockName, timeoutSeconds) => {
    const [[row]] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [lockName, timeoutSeconds]);
    if (!row || Number(row.acquired) !== 1) {
        throw new BusinessError('Another Document Flow upload is being saved. Please try again in a moment.', 409);
    }
};

const releaseCommitLock = async (connection, lockName) => {
    try {
        await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    } catch (error) {
        console.error('Release lock failed:', error);
    }
};

module.exports = { acquireCommitLock, releaseCommitLock };
