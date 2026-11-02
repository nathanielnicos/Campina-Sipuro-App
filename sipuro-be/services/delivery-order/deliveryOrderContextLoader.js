'use strict';

/**
 * Memuat data database yang dibutuhkan kalkulator Delivery Order.
 * Dipakai oleh preview (tanpa lock) dan commit (baris alokasi dikunci di dalam transaksi), sehingga
 * keduanya menghitung dari bentuk data yang sama.
 */

const { chunk } = require('../../helpers/arrayUtils');
const { fetchLotStock } = require('./deliveryOrderTotals');

const loadDeliveryOrderContext = async (queryable, rawRows, { forUpdate = false } = {}) => {
    const [allProducts] = await queryable.query(
        'SELECT id_product, product_code, product_name, pcs_per_ctn FROM products'
    );

    // Baris yang sudah pernah diproses (detail upload DO dan retur)
    const existingHashes = [];
    const uniqueHashes = [...new Set(rawRows.map((r) => r.rowHash))];
    for (const part of chunk(uniqueHashes, 500)) {
        const [rows] = await queryable.query(
            'SELECT DISTINCT row_hash FROM delivery_order_upload_details WHERE row_hash IN (?)',
            [part]
        );
        rows.forEach((r) => existingHashes.push(r.row_hash));
    }

    const lotNumbers = [...new Set(rawRows.map((r) => r.lotNumber).filter(Boolean))];

    const lotsFound = new Set();
    for (const part of chunk(lotNumbers, 500)) {
        const [rows] = await queryable.query('SELECT DISTINCT lot_number FROM lots WHERE lot_number IN (?)', [part]);
        rows.forEach((r) => lotsFound.add(r.lot_number));
    }

    // Alokasi lot dikunci berurutan (id) agar total yang dibaca tidak berubah oleh proses lain
    if (forUpdate) {
        for (const part of chunk(lotNumbers, 500)) {
            await queryable.query(
                `SELECT pla.id FROM po_lot_allocations pla
                 JOIN lots l ON pla.lot_id = l.id
                 WHERE l.lot_number IN (?)
                 ORDER BY pla.id FOR UPDATE`,
                [part]
            );
        }
    }

    const { allocated, delivered, returned } = await fetchLotStock(queryable, lotNumbers);

    return {
        existingHashes,
        allProducts,
        stock: { lotsFound, allocated, delivered, returned }
    };
};

module.exports = { loadDeliveryOrderContext };
