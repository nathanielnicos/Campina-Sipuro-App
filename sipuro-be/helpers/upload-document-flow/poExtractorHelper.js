const extractPONumbers = (rawCustomerPO) => {
    if (!rawCustomerPO || typeof rawCustomerPO !== 'string') return [];

    // Pattern ekstraksi format umum PO (cth: 044/PO/CRMI/2025)
    const poRegex = /\b\d{3,4}\/PO\/[A-Z0-9_\-\/]+\/\d{4}\b/gi;
    const matches = rawCustomerPO.match(poRegex);

    if (matches && matches.length > 0) {
        return [...new Set(matches.map(m => m.trim()))];
    }

    // Fallback split jika dipisahkan koma/garis miring/spasi
    return rawCustomerPO
        .split(/[,;\n\/]+/)
        .map(p => p.trim())
        .filter(p => p.length >= 3);
};

module.exports = { extractPONumbers };
