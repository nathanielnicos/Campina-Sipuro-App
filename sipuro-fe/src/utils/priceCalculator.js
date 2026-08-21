export const calculateUnitPrice = (basePrice, baseUom, selectedUom, pcsPerCtn, ctnPerPlt) => {
    const pCtn = parseFloat(pcsPerCtn) || 1;
    const cPlt = parseFloat(ctnPerPlt) || 1;
    let factor = 1;

    if (baseUom === 'PCS') {
        if (selectedUom === 'CTN') factor = pCtn;
        else if (selectedUom === 'PLT') factor = pCtn * cPlt;
    } else if (baseUom === 'CTN') {
        if (selectedUom === 'PCS') factor = 1 / pCtn;
        else if (selectedUom === 'PLT') factor = cPlt;
    } else if (baseUom === 'PLT') {
        if (selectedUom === 'CTN') factor = 1 / cPlt;
        else if (selectedUom === 'PCS') factor = 1 / (pCtn * cPlt);
    }

    return basePrice * factor;
};
