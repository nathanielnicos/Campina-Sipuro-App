export const calculateUnitPrice = (basePrice, baseUom, selectedUom, pcsPerCtn = 1, ctnPerPlt = 1) => {
    const pCtn = Number(pcsPerCtn) || 1;
    const cPlt = Number(ctnPerPlt) || 1;
    if (baseUom === selectedUom) return basePrice;

    const RATES = {
        PCS: { CTN: pCtn, PLT: pCtn * cPlt },
        CTN: { PCS: 1 / pCtn, PLT: cPlt },
        PLT: { CTN: 1 / cPlt, PCS: 1 / (pCtn * cPlt) }
    };

    return basePrice * (RATES[baseUom]?.[selectedUom] || 1);
};
