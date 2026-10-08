const crypto = require('crypto');

const generateFileHash = (buffer) => {
    return crypto.createHash('sha256').update(buffer).digest('hex');
};

const generateRowHash = (rowObj) => {
    const serialized = JSON.stringify(rowObj);
    return crypto.createHash('sha256').update(serialized).digest('hex');
};

module.exports = { generateFileHash, generateRowHash };
