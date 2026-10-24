'use strict';

const { calculateBaseQty } = require('./poHelper');
const { currentPriceCondition } = require('./po/currentPriceRules');
const {
    MAX_ITEM_QTY,
    mulDivRound,
    toCents,
    fromCents,
    parseQty,
    calcLineTotal,
    calcOrderTotals
} = require('./money');

// Batas nilai kolom INT(11) untuk base_qty.
const MAX_INT_COLUMN = 2147483647;

const STATUS_WAITING = 'Waiting for Confirmation';

/**
 * Kesalahan validasi input PO. Controller mengubahnya menjadi respons HTTP 400
 * dengan pesan yang aman ditampilkan ke pengguna.
 */
class PoValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PoValidationError';
        this.isValidation = true;
        this.statusCode = 400;
    }
}

// Format ribuan gaya Indonesia (1.000.000.000) tanpa bergantung pada data locale server.
const formatThousand = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Validasi dan normalisasi baris item dari request.
 * Harga dan total dari klien sengaja tidak dibaca sama sekali.
 */
function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new PoValidationError('Incomplete request data.');
    }

    const seenProducts = new Set();

    return items.map((item) => {
        const idProduct = Number(item && item.id_product);
        if (!Number.isInteger(idProduct) || idProduct <= 0) {
            throw new PoValidationError('Every item row must have a product selected.');
        }

        const qty = parseQty(item.qty);
        if (qty === null || qty < 1) {
            throw new PoValidationError('Quantity must be a whole number of at least 1.');
        }
        if (qty > MAX_ITEM_QTY) {
            throw new PoValidationError(`Quantity per row cannot exceed ${formatThousand(MAX_ITEM_QTY)}.`);
        }

        if (seenProducts.has(idProduct)) {
            throw new PoValidationError('The same product cannot be added more than once. Please combine the quantities into one row.');
        }
        seenProducts.add(idProduct);

        const detailId = Number(item.po_detail_id);

        return {
            id_product: idProduct,
            qty,
            po_detail_id: Number.isInteger(detailId) && detailId > 0 ? detailId : undefined,
            notes: item.notes ? String(item.notes).trim().slice(0, 255) || null : null
        };
    });
}

/**
 * Harga yang sedang berlaku hari ini per produk (aturan yang sama dengan daftar produk).
 * Jika ada lebih dari satu harga aktif, dipakai yang start_date-nya paling baru.
 */
async function fetchCurrentPrices(db, productIds) {
    if (productIds.length === 0) return new Map();

    const [rows] = await db.query(
        `SELECT sp.id_product, sp.price
         FROM sipuro_db.product_selling_prices sp
         WHERE sp.id_product IN (?)
           AND ${currentPriceCondition('sp')}
         ORDER BY sp.id_product ASC, sp.start_date DESC, sp.price_id DESC`,
        [productIds]
    );

    const priceMap = new Map();
    rows.forEach((row) => {
        if (!priceMap.has(row.id_product)) priceMap.set(row.id_product, toCents(row.price));
    });
    return priceMap;
}

/**
 * Hitung harga seluruh item PO di server.
 *
 * Aturan harga:
 *  - PO baru dan PO berstatus Draft: semua baris memakai harga aktif hari ini
 *    (Draft belum final, seperti keranjang).
 *  - PO berstatus Waiting for Confirmation yang diedit: baris lama dengan produk yang sama
 *    tetap memakai harga tersimpan; baris baru atau baris yang produknya diganti
 *    memakai harga aktif hari ini.
 *
 * @param {object} params
 * @param {object} params.db            koneksi atau pool dengan method query()
 * @param {Array}  params.items         item dari request
 * @param {string|null} params.poStatus status PO yang sedang diedit, null untuk PO baru
 * @param {Map|null} params.existingMap detail aktif PO (po_detail_id -> baris dengan
 *                                      id_product, qty, base_qty, base_price), null untuk PO baru
 * @param {number} params.ppnPercent    persen PPN
 */
async function priceItems({ db, items, poStatus = null, existingMap = null, ppnPercent }) {
    const normalized = normalizeItems(items);
    const productIds = normalized.map((item) => item.id_product);

    const [productRows] = await db.query(
        `SELECT id_product, product_name, base_uom, pcs_per_ctn, ctn_per_plt, ml_per_pcs, kg_per_pcs, is_active
         FROM sipuro_db.products
         WHERE id_product IN (?)`,
        [productIds]
    );
    const productMap = new Map(productRows.map((p) => [p.id_product, p]));

    productIds.forEach((id) => {
        if (!productMap.has(id)) {
            throw new PoValidationError('A selected product no longer exists. Please remove it from the PO.');
        }
    });

    // Tentukan sumber harga tiap baris.
    const lockExisting = poStatus === STATUS_WAITING && existingMap instanceof Map;
    const decisions = normalized.map((item) => {
        if (lockExisting && item.po_detail_id && existingMap.has(item.po_detail_id)) {
            const old = existingMap.get(item.po_detail_id);
            const oldQty = Number(old.qty);
            const oldBaseQty = Number(old.base_qty);
            const oldBaseCents = toCents(old.base_price);
            if (Number(old.id_product) === item.id_product && oldQty > 0 && oldBaseQty > 0 && oldBaseCents > 0) {
                // Harga satuan terkunci (per satuan yang dipilih) dari harga dasar tersimpan.
                const lockedUnitCents = mulDivRound(oldBaseCents, oldBaseQty, oldQty);
                return { item, unitCents: lockedUnitCents };
            }
        }
        return { item, unitCents: null };
    });

    const needCurrent = decisions.filter((d) => d.unitCents === null).map((d) => d.item.id_product);
    const currentPrices = await fetchCurrentPrices(db, needCurrent);

    const lines = decisions.map(({ item, unitCents }) => {
        const product = productMap.get(item.id_product);

        let finalUnitCents = unitCents;
        if (finalUnitCents === null) {
            const currentCents = currentPrices.get(item.id_product);
            if (Number(product.is_active) !== 1 || !currentCents || currentCents <= 0) {
                throw new PoValidationError(
                    `Product "${product.product_name}" is no longer available. Please remove it from the PO.`
                );
            }
            finalUnitCents = currentCents;
        }

        // Satuan selalu satuan dasar produk (pilihan UOM di layar sudah terkunci).
        const uom = product.base_uom || 'PCS';
        const baseQty = calculateBaseQty(item.qty, uom, product);
        if (!Number.isFinite(baseQty) || baseQty < 1 || baseQty > MAX_INT_COLUMN) {
            throw new PoValidationError(`Quantity for "${product.product_name}" is too large.`);
        }

        const totalPrice = calcLineTotal(finalUnitCents, item.qty);
        // Harga per satuan dasar, 2 desimal (sama dengan harga master bila satuan = satuan dasar).
        const baseCents = mulDivRound(finalUnitCents, item.qty, baseQty);

        return {
            po_detail_id: item.po_detail_id,
            id_product: item.id_product,
            qty: item.qty,
            uom,
            baseQty,
            unitPrice: fromCents(finalUnitCents),
            basePrice: fromCents(baseCents),
            totalPrice,
            pcsPerCtn: Number(product.pcs_per_ctn || 1),
            ctnPerPlt: Number(product.ctn_per_plt || 1),
            mlPerPcs: product.ml_per_pcs !== undefined ? product.ml_per_pcs : null,
            kgPerPcs: product.kg_per_pcs !== undefined ? product.kg_per_pcs : null,
            notes: item.notes
        };
    });

    const totals = calcOrderTotals(lines.map((line) => line.totalPrice), ppnPercent);

    return {
        lines,
        subtotal: totals.subtotal,
        ppnAmount: totals.ppnAmount,
        totalAmount: totals.total
    };
}

module.exports = {
    PoValidationError,
    normalizeItems,
    priceItems
};
