const crypto = require('crypto');

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

// Hash natural unik: SI Number + DO Number + Product ID
const generateSiRowHash = (siNumber, doNumber, productId) =>
    sha256(['SI', String(siNumber).trim().toUpperCase(), String(doNumber).trim().toUpperCase(), Number(productId)].join('|'));

module.exports = {
    sha256,
    generateSiRowHash
};
