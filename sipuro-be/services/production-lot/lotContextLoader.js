/**
 * Memuat seluruh data database yang dibutuhkan kalkulator lot produksi.
 * Dipakai oleh preview (tanpa lock) dan commit (dengan lock FOR UPDATE di dalam transaksi),
 * sehingga keduanya menghitung dari bentuk data yang sama.
 */
const { chunk } = require('../../helpers/arrayUtils');
const { NOT_DELETED_SQL } = require('../../helpers/po/openItemRules');
const { fetchLotStock } = require('../delivery-order/deliveryOrderTotals');
const { buildFamilyIndex } = require('../product-code-mapping/productFamilies');
const { buildStockCodeResolver } = require('../product-code-mapping/stockFamilyKey');
const {
    ELIGIBLE_HEADER_STATUSES,
    ELIGIBLE_DETAIL_STATUSES,
    MATCH_BY,
    allocatedQtySql
} = require('./lotAllocationRules');

/**
 * Item PO beserta qty teralokasi (rumus di lotAllocationRules). Satu-satunya query PO untuk kalkulator.
 * @param {string} whereSql kondisi tambahan (mis. 'd.id_product IN (?)'), params-nya di `params`
 */
const fetchPoDetails = async (queryable, extraWhereSql, params) => {
    const [rows] = await queryable.query(
        `SELECT
            d.po_detail_id,
            d.po_header_id,
            d.id_product,
            d.base_qty,
            ${allocatedQtySql('d.po_detail_id')} AS fulfilled_qty,
            d.status AS detail_status,
            h.po_number,
            DATE_FORMAT(h.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            h.status AS header_status,
            p.product_code,
            p.product_name
         FROM po_details d
         JOIN po_headers h ON d.po_header_id = h.po_header_id
         JOIN products p ON d.id_product = p.id_product
         WHERE ${NOT_DELETED_SQL}
           AND h.status IN (?)
           AND d.status IN (?)
           AND ${extraWhereSql}
         ORDER BY h.created_at ASC, d.po_detail_id ASC`,
        [ELIGIBLE_HEADER_STATUSES, ELIGIBLE_DETAIL_STATUSES, ...params]
    );
    return rows;
};

const loadProductionLotContext = async (queryable, rawRows, { forUpdate = false } = {}) => {
    const lock = forUpdate ? ' FOR UPDATE' : '';

    // 1. Ambil seluruh master products
    const [allProducts] = await queryable.query(
        'SELECT id_product, product_code, product_name, is_active FROM products'
    );

    // 2. Cek Hash baris yang sudah ada di tabel log upload lot yang baru
    const existingHashes = [];
    const uniqueHashes = [...new Set(rawRows.flatMap((r) => (r.legacyRowHash ? [r.rowHash, r.legacyRowHash] : [r.rowHash])))];
    for (const part of chunk(uniqueHashes, 500)) {
        const [rows] = await queryable.query(
            'SELECT DISTINCT row_hash FROM production_lot_upload_details WHERE row_hash IN (?)',
            [part]
        );
        rows.forEach((r) => existingHashes.push(r.row_hash));
    }

    // 3. Tentukan produk yang ada di file Excel, lalu perluas ke seluruh produk sekeluarga
    //    (pemetaan kode produk AKTIF): PO produk setara ikut dimuat sebagai kandidat alokasi.
    const [productMappings] = await queryable.query(
        'SELECT id_product_old, id_product_new FROM product_code_mappings WHERE is_active = 1'
    );
    const families = buildFamilyIndex(productMappings);
    const codesInFile = new Set(rawRows.map((r) => r.itemCode));
    const productIds = [...new Set(
        allProducts
            .filter((p) => codesInFile.has(p.product_code))
            .flatMap((p) => families.familyOf(p.id_product))
    )].sort((a, b) => a - b);

    // 4. Muat Batch yang sudah ada di database berdasarkan batchNumber dari file
    // Baris berbasis lot tidak punya batch (kosong): tidak dicari
    const batchNumbers = [...new Set(rawRows.map((r) => r.batchNumber).filter(Boolean))];
    let existingBatches = [];
    if (batchNumbers.length > 0) {
        for (const part of chunk(batchNumbers, 500)) {
            const [rows] = await queryable.query(
                'SELECT id, batch_number, id_product FROM batches WHERE batch_number IN (?)',
                [part]
            );
            existingBatches.push(...rows);
        }
    }

    // 5. Muat Lot yang sudah ada di database berdasarkan lotNumber dari file
    const lotNumbers = [...new Set(rawRows.map((r) => r.lotNumber))];
    let existingLots = [];
    if (lotNumbers.length > 0) {
        for (const part of chunk(lotNumbers, 500)) {
            const [rows] = await queryable.query(
                'SELECT id, lot_number, id_product, actual_completed_datetime, expired_date FROM lots WHERE lot_number IN (?)',
                [part]
            );
            existingLots.push(...rows);
        }
    }

    // 5a. Baris upload yang sudah tersimpan pada lot-lot di file: dasar mendeteksi baris yang sama dengan tanggal
    //     kedaluwarsa berbeda (hanya dibaca, dipakai sebagai peringatan di preview)
    const existingDetailRows = [];
    for (const part of chunk(lotNumbers.filter(Boolean), 500)) {
        const [rows] = await queryable.query(
            `SELECT batch_number, lot_number, item_code, trans_type, qty_pac,
                    DATE_FORMAT(actual_completed_datetime, '%Y-%m-%d %H:%i:%s') AS completed,
                    DATE_FORMAT(expired_date, '%Y-%m-%d') AS expired, doc_source
             FROM production_lot_upload_details
             WHERE lot_number IN (?)`,
            [part]
        );
        existingDetailRows.push(...rows);
    }

    // 6. Lock berurutan (po_details) agar tidak deadlock antar-commit saat proses simpan
    if (forUpdate && productIds.length > 0) {
        await queryable.query(
            `SELECT d.po_detail_id FROM po_details d
             WHERE d.id_product IN (?) AND ${NOT_DELETED_SQL} AND d.status IN (?)
             ORDER BY d.po_detail_id${lock}`,
            [productIds, ELIGIBLE_DETAIL_STATUSES]
        );
    }

    // 7. Muat alokasi PO lama berdasarkan Lot (dari po_lot_allocations); id_batch membedakan batch
    let existingAllocations = [];
    const lotIds = existingLots.map((l) => l.id);
    if (lotIds.length > 0) {
        for (const part of chunk(lotIds, 500)) {
            const [rows] = await queryable.query(
                `SELECT id, po_detail_id, lot_id, id_batch, allocated_qty, status
                 FROM po_lot_allocations
                 WHERE lot_id IN (?)
                 ORDER BY id${lock}`,
                [part]
            );
            existingAllocations.push(...rows);
        }
    }

    // 7a. Batch milik alokasi-alokasi itu (id -> nomor): jenis berbasis lot mengurangi alokasi lintas batch,
    //     sehingga batch yang terkena tidak harus ada di file.
    const allocationBatches = [];
    const allocationBatchIds = [...new Set(existingAllocations.map((a) => a.id_batch))].sort((a, b) => a - b);
    for (const part of chunk(allocationBatchIds, 500)) {
        const [rows] = await queryable.query(
            'SELECT id, batch_number FROM batches WHERE id IN (?)',
            [part]
        );
        allocationBatches.push(...rows);
    }

    // 7b. Total alokasi dan qty terkirim BERSIH (terkirim - retur) per (keluarga produk, lot); baris alokasi lot sudah terkunci di atas
    const stockCodes = buildStockCodeResolver(allProducts, productMappings);
    const { allocated: lotAllocated, netDelivered: lotDelivered } = await fetchLotStock(queryable, lotNumbers, { stockCodes });

    // 7c. Hanya bila file memuat baris non-produksi arah IN (qty positif, berbasis lot):
    //     (i) pengurangan dan pemulihan sebelumnya per (Doc Source, lot, alokasi asal) dari riwayat alokasi,
    //     (ii) batch yang memproduksi lot-lot itu (tempat tambahan output ditempelkan).
    const docReductions = [];
    const lotBatches = [];
    const inLotRows = rawRows.filter((r) => r.matchBy === MATCH_BY.LOT && Number(r.rawAllocationQty) > 0);
    if (inLotRows.length > 0 && lotIds.length > 0) {
        const docSources = [...new Set(inLotRows.map((r) => r.docSource).filter(Boolean))];
        for (const part of chunk(docSources, 500)) {
            const [rows] = await queryable.query(
                `SELECT lg.doc_source, lg.lot_id, lg.po_detail_id, lg.id_batch,
                        SUM(GREATEST(lg.old_allocated_qty - lg.new_allocated_qty, 0)) AS reduced_qty,
                        SUM(GREATEST(lg.new_allocated_qty - lg.old_allocated_qty, 0)) AS restored_qty
                 FROM sipuro_db.po_lot_allocation_logs lg
                 WHERE lg.doc_source IN (?) AND lg.lot_id IN (?)
                 GROUP BY lg.doc_source, lg.lot_id, lg.po_detail_id, lg.id_batch`,
                [part, lotIds]
            );
            docReductions.push(...rows);
        }
        for (const part of chunk(lotIds, 500)) {
            // COLLATE: kolom di tabel upload memakai collation berbeda dari lots/batches/products
            const [rows] = await queryable.query(
                `SELECT DISTINCT l.id AS lot_id, b.id AS id_batch, b.batch_number
                 FROM lots l
                 JOIN products p ON p.id_product = l.id_product
                 JOIN production_lot_upload_details d
                   ON d.lot_number COLLATE utf8mb4_unicode_ci = l.lot_number COLLATE utf8mb4_unicode_ci
                  AND d.item_code COLLATE utf8mb4_unicode_ci = p.product_code COLLATE utf8mb4_unicode_ci
                  AND d.batch_number <> ''
                 JOIN batches b ON b.batch_number COLLATE utf8mb4_unicode_ci = d.batch_number COLLATE utf8mb4_unicode_ci
                 WHERE l.id IN (?)`,
                [part]
            );
            lotBatches.push(...rows);
        }
    }
    // Batch dari riwayat pemulihan juga perlu namanya (alokasi asal bisa tidak ada lagi di daftar batch alokasi)
    const knownBatchIds = new Set(allocationBatches.map((b) => Number(b.id)));
    const missingBatchIds = [...new Set(docReductions.map((r) => Number(r.id_batch)))].filter((id) => !knownBatchIds.has(id));
    for (const part of chunk(missingBatchIds, 500)) {
        const [rows] = await queryable.query('SELECT id, batch_number FROM batches WHERE id IN (?)', [part]);
        allocationBatches.push(...rows);
    }

    // 8. Ambil PO yang layak. fulfilled_qty dihitung dari po_lot_allocations (rumus di lotAllocationRules)
    const openPoDetails = [];
    for (const part of chunk(productIds, 500)) {
        openPoDetails.push(...await fetchPoDetails(queryable, 'd.id_product IN (?)', [part]));
    }

    // 9. PO yang sudah memegang alokasi lot-lot di file tetapi produknya bukan produk di file
    //    (alokasi lewat pemetaan kode): wajib dimuat agar retur dapat mengurangi alokasinya.
    const loadedDetailIds = new Set(openPoDetails.map((po) => po.po_detail_id));
    const extraDetailIds = [...new Set(existingAllocations.map((a) => a.po_detail_id))]
        .filter((id) => !loadedDetailIds.has(id))
        .sort((a, b) => a - b);
    for (const part of chunk(extraDetailIds, 500)) {
        if (forUpdate) {
            await queryable.query(
                `SELECT d.po_detail_id FROM po_details d
                 WHERE d.po_detail_id IN (?) AND ${NOT_DELETED_SQL}
                 ORDER BY d.po_detail_id${lock}`,
                [part]
            );
        }
        openPoDetails.push(...await fetchPoDetails(queryable, 'd.po_detail_id IN (?)', [part]));
    }

    return {
        existingHashes,
        openPoDetails,
        allProducts,
        context: { 
            existingBatches, 
            existingLots, 
            existingAllocations,
            allocationBatches,
            lotAllocated,
            lotDelivered,
            docReductions,
            lotBatches,
            existingDetailRows,
            productMappings
        }
    };
};

module.exports = { loadProductionLotContext, fetchPoDetails };
