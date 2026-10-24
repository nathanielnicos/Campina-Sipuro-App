'use strict';

/**
 * Definisi tunggal "harga jual yang berlaku hari ini" (tabel product_selling_prices).
 * Dipakai oleh perhitungan harga PO (poPricing), daftar produk untuk customer (masterController),
 * dan penanda harga di PO Requirement, sehingga ketiganya selalu sepakat.
 */

// Syarat baris harga yang sedang berlaku; `alias` adalah alias tabel product_selling_prices di query.
const currentPriceCondition = (alias) => (
    `${alias}.start_date <= CURDATE() AND (${alias}.end_date IS NULL OR ${alias}.end_date >= CURDATE())`
);

// Ekspresi 1 / 0: apakah produk (alias tabel products) punya harga yang berlaku hari ini.
const hasCurrentPriceSql = (productAlias) => (
    `EXISTS (SELECT 1 FROM sipuro_db.product_selling_prices sp_now
        WHERE sp_now.id_product = ${productAlias}.id_product AND ${currentPriceCondition('sp_now')})`
);

module.exports = { currentPriceCondition, hasCurrentPriceSql };
