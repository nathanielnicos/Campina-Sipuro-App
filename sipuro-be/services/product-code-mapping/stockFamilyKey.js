'use strict';

/**
 * Kunci stok keluarga produk untuk kuota Delivery Order dan batas pengurangan alokasi lot.
 *
 * Dua kode produk yang dipetakan (kode lama dan penggantinya, lihat productFamilies) sebenarnya barang yang sama.
 * Nomor lot yang sama bisa tercatat di produksi dengan kedua kode itu (mis. 725 pcs berkode lama dan 15.680 pcs
 * berkode baru), sedangkan baris Delivery Order boleh memakai salah satunya. Karena itu alokasi, pengiriman, dan
 * retur dihitung per (keluarga produk, nomor lot), bukan per kode produk.
 *
 * Kode kanonik keluarga = kode produk anggota dengan id terkecil. Produk tanpa pemetaan memakai kodenya sendiri,
 * sehingga untuk produk tanpa pemetaan kuncinya sama persis dengan sebelumnya: stockKey(kode, lot).
 * Fungsi murni (tanpa akses database).
 */

const { buildFamilyIndex } = require('./productFamilies');

/**
 * @param {Array<{id_product:number, product_code:string}>} allProducts
 * @param {Array<{id_product_old:number, id_product_new:number}>} productMappings pemetaan AKTIF
 * @returns {{ forProductId: (id:number) => (string|null), forProductCode: (code:string) => string }}
 */
const buildStockCodeResolver = (allProducts = [], productMappings = []) => {
    const families = buildFamilyIndex(productMappings);
    const codeById = new Map();
    const idByCode = new Map();
    allProducts.forEach((p) => {
        codeById.set(Number(p.id_product), p.product_code);
        idByCode.set(p.product_code, Number(p.id_product));
    });

    const forProductId = (idProduct) => {
        const id = Number(idProduct);
        const rootId = families.familyOf(id)[0];
        if (codeById.has(rootId)) return codeById.get(rootId);
        return codeById.has(id) ? codeById.get(id) : null;
    };

    const forProductCode = (code) => {
        if (!idByCode.has(code)) return code;
        const canonical = forProductId(idByCode.get(code));
        return canonical === null ? code : canonical;
    };

    return { forProductId, forProductCode };
};

// Tanpa pemetaan: kode produk apa adanya (perilaku lama)
const IDENTITY_STOCK_CODES = Object.freeze({
    forProductId: () => null,
    forProductCode: (code) => code
});

module.exports = { buildStockCodeResolver, IDENTITY_STOCK_CODES };
