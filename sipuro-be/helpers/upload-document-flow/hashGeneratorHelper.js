const crypto = require('crypto');

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

const generateFileHash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// Natural-key hashes (do not include quantities or dates, so a corrected export of the same DO is still a duplicate).
// delivery_orders.row_hash  : DO number + product
// sales_invoices.row_hash   : SI number + DO number + product
const generateDoRowHash = (doNumber, productId) =>
    sha256(['DO', String(doNumber).trim().toUpperCase(), Number(productId)].join('|'));

const generateSiRowHash = (siNumber, doNumber, productId) =>
    sha256([
        'SI',
        String(siNumber).trim().toUpperCase(),
        String(doNumber).trim().toUpperCase(),
        Number(productId)
    ].join('|'));

module.exports = { generateFileHash, generateDoRowHash, generateSiRowHash, sha256 };
