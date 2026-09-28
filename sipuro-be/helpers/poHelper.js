/**
 * Helper untuk menghitung Base Qty (dalam PCS) berdasarkan UOM yang dipilih
 */
const calculateBaseQty = (qty, uom, product) => {
    const uppercaseUom = (uom || '').toUpperCase();
    const pcsPerCtn = product ? Number(product.pcs_per_ctn || 1) : 1;
    const ctnPerPlt = product ? Number(product.ctn_per_plt || 1) : 1;

    if (uppercaseUom === 'CTN') {
        return qty * pcsPerCtn;
    } else if (uppercaseUom === 'PLT') {
        return qty * pcsPerCtn * ctnPerPlt;
    }
    return qty;
};

module.exports = {
    calculateBaseQty
};
