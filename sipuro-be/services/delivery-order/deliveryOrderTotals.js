'use strict';

/**
 * Total per (keluarga produk, nomor lot) untuk modul Delivery Order, dibaca dari database.
 * Kunci memakai kode kanonik keluarga produk (lihat stockFamilyKey): kode lama dan kode pengganti
 * yang dipetakan memakai satu stok per nomor lot. Tanpa `stockCodes`, kunci = kode produk apa adanya.
 * Kode produk di sini adalah kode hasil produksi (lots.id_product), BUKAN kode produk di PO:
 * sebuah lot bisa dialokasikan ke PO berkode lama lewat pemetaan kode produk, tetapi barang
 * fisiknya tetap satu produk. Dengan begitu DO (yang membawa kode produksi) dan alokasi lot
 * selalu bertemu pada kunci yang sama, berapa pun jumlah PO yang memegang alokasi lot itu.
 *  - allocated : jumlah allocated_qty alokasi non-Canceled dari lot itu, ke PO mana pun
 *  - delivered : jumlah qty_pcs di delivery_order_lots
 *  - returned  : jumlah qty_pcs di delivery_returns
 *  - netDelivered : terkirim dikurangi retur (tidak pernah negatif). Retur membuka kuota kirim lagi, jadi batas "alokasi
 *                   tidak boleh di bawah qty terkirim" di modul lot memakai terkirim BERSIH ini
 * Dipakai kalkulator upload DO dan aturan "alokasi lot tidak boleh di bawah qty terkirim" di modul lot.
 * Satu-satunya tempat yang mendefinisikan rumus ini.
 */

const { chunk } = require('../../helpers/arrayUtils');
const { NOT_DELETED_SQL } = require('../../helpers/po/openItemRules');
const { ALLOCATION_STATUS } = require('../production-lot/lotAllocationRules');
const { stockKey } = require('./deliveryOrderRules');
const { buildStockCodeResolver, IDENTITY_STOCK_CODES } = require('../product-code-mapping/stockFamilyKey');

const ALLOCATED_SQL = `SELECT p.product_code, l.lot_number, SUM(pla.allocated_qty) AS total_qty
    FROM po_lot_allocations pla
    JOIN po_details d ON pla.po_detail_id = d.po_detail_id
    JOIN lots l ON pla.lot_id = l.id
    JOIN products p ON l.id_product = p.id_product
    WHERE l.lot_number IN (?) AND pla.status <> '${ALLOCATION_STATUS.CANCELED}' AND ${NOT_DELETED_SQL}
    GROUP BY p.product_code, l.lot_number`;

const DELIVERED_SQL = `SELECT p.product_code, t.lot_number, SUM(t.qty_pcs) AS total_qty
    FROM delivery_order_lots t
    JOIN products p ON t.product_id = p.id_product
    WHERE t.lot_number IN (?)
    GROUP BY p.product_code, t.lot_number`;

const RETURNED_SQL = `SELECT p.product_code, t.lot_number, SUM(t.qty_pcs) AS total_qty
    FROM delivery_returns t
    JOIN products p ON t.product_id = p.id_product
    WHERE t.lot_number IN (?)
    GROUP BY p.product_code, t.lot_number`;

const loadTotals = async (queryable, sql, lotNumbers, stockCodes) => {
    const totals = new Map();
    for (const part of chunk(lotNumbers, 500)) {
        const [rows] = await queryable.query(sql, [part]);
        rows.forEach((r) => {
            const key = stockKey(stockCodes.forProductCode(r.product_code), r.lot_number);
            totals.set(key, (totals.get(key) || 0) + (Number(r.total_qty) || 0));
        });
    }
    return totals;
};

// Terkirim bersih per kunci: terkirim dikurangi retur, tidak pernah negatif
const toNetDelivered = (delivered, returned) => {
    const net = new Map();
    delivered.forEach((qty, key) => net.set(key, Math.max(0, qty - (returned.get(key) || 0))));
    return net;
};

// Pemetaan kode produk AKTIF + daftar produk -> penentu kode kanonik keluarga
const loadStockCodes = async (queryable) => {
    const [mappings] = await queryable.query(
        'SELECT id_product_old, id_product_new FROM product_code_mappings WHERE is_active = 1'
    );
    const [products] = await queryable.query('SELECT id_product, product_code FROM products');
    return buildStockCodeResolver(products, mappings);
};

/**
 * @param {string[]} lotNumbers nomor lot yang ingin dihitung
 * @param {{ stockCodes?: { forProductCode: (code:string) => string } }} [options] penentu kode kanonik keluarga
 * @returns {Promise<{ allocated: Map, delivered: Map, returned: Map, netDelivered: Map }>} kunci = stockKey(kode kanonik, lotNumber)
 */
const fetchLotStock = async (queryable, lotNumbers, { stockCodes = IDENTITY_STOCK_CODES } = {}) => {
    const lots = [...new Set(lotNumbers)].filter(Boolean);
    if (lots.length === 0) {
        return { allocated: new Map(), delivered: new Map(), returned: new Map(), netDelivered: new Map() };
    }
    const delivered = await loadTotals(queryable, DELIVERED_SQL, lots, stockCodes);
    const returned = await loadTotals(queryable, RETURNED_SQL, lots, stockCodes);
    return {
        allocated: await loadTotals(queryable, ALLOCATED_SQL, lots, stockCodes),
        delivered,
        returned,
        netDelivered: toNetDelivered(delivered, returned)
    };
};

/**
 * Saldo satu lot: total alokasi non-Canceled (ke PO mana pun), qty terkirim, retur, dan terkirim bersih, dihitung per keluarga produk
 * (nomor lot yang sama dengan kode lama dan kode pengganti dijumlahkan).
 * Produk ditentukan oleh lot itu sendiri (lots.id_product), sehingga alokasi lewat pemetaan kode
 * tetap terhitung. Dipakai aturan "alokasi tidak boleh turun di bawah qty terkirim bersih" pada perubahan manual.
 */
const fetchItemLotBalance = async (queryable, { lotId }) => {
    const [[row]] = await queryable.query(
        'SELECT p.product_code, l.lot_number FROM lots l JOIN products p ON p.id_product = l.id_product WHERE l.id = ?',
        [lotId]
    );
    if (!row) return { itemCode: null, lotNumber: null, allocated: 0, delivered: 0, returned: 0, netDelivered: 0 };
    const stockCodes = await loadStockCodes(queryable);
    const { allocated, delivered, returned, netDelivered } = await fetchLotStock(queryable, [row.lot_number], { stockCodes });
    const key = stockKey(stockCodes.forProductCode(row.product_code), row.lot_number);
    return {
        itemCode: row.product_code,
        lotNumber: row.lot_number,
        allocated: Number(allocated.get(key)) || 0,
        delivered: Number(delivered.get(key)) || 0,
        returned: Number(returned.get(key)) || 0,
        netDelivered: Number(netDelivered.get(key)) || 0
    };
};

module.exports = { fetchLotStock, fetchItemLotBalance, loadStockCodes };
