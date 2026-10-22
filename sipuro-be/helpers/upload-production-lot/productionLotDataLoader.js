/**
 * Memuat seluruh data database yang dibutuhkan kalkulator lot produksi.
 * Dipakai oleh preview (tanpa lock) dan commit (dengan lock FOR UPDATE di dalam transaksi),
 * sehingga keduanya menghitung dari bentuk data yang sama.
 */
const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const loadProductionLotContext = async (queryable, rawRows, { forUpdate = false } = {}) => {
    const lock = forUpdate ? ' FOR UPDATE' : '';

    // 1. Ambil seluruh master products
    const [allProducts] = await queryable.query(
        'SELECT id_product, product_code, product_name FROM products'
    );

    // 2. Cek Hash baris yang sudah ada di tabel log upload lot yang baru
    const existingHashes = [];
    const uniqueHashes = [...new Set(rawRows.map((r) => r.rowHash))];
    for (const part of chunk(uniqueHashes, 500)) {
        const [rows] = await queryable.query(
            'SELECT DISTINCT row_hash FROM production_lot_upload_details WHERE row_hash IN (?)',
            [part]
        );
        rows.forEach((r) => existingHashes.push(r.row_hash));
    }

    // 3. Tentukan produk yang ada di file Excel
    const codesInFile = new Set(rawRows.map((r) => r.itemCode));
    const productIds = allProducts
        .filter((p) => codesInFile.has(p.product_code))
        .map((p) => p.id_product);

    // 4. Muat Batch yang sudah ada di database berdasarkan batchNumber dari file
    const batchNumbers = [...new Set(rawRows.map((r) => r.batchNumber))];
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

    // 6. Lock berurutan (po_details) agar tidak deadlock antar-commit saat proses simpan
    if (forUpdate && productIds.length > 0) {
        await queryable.query(
            `SELECT po_detail_id FROM po_details
             WHERE id_product IN (?) AND deleted_at IS NULL AND status IN ('Active', 'Close Requested')
             ORDER BY po_detail_id${lock}`,
            [productIds]
        );
    }

    // 7. Muat alokasi PO lama berdasarkan Lot (dari po_lot_allocations)
    let existingAllocations = [];
    const lotIds = existingLots.map((l) => l.id);
    if (lotIds.length > 0) {
        for (const part of chunk(lotIds, 500)) {
            const [rows] = await queryable.query(
                `SELECT id, po_detail_id, lot_id, allocated_qty, status
                 FROM po_lot_allocations
                 WHERE lot_id IN (?)
                 ORDER BY id${lock}`,
                [part]
            );
            existingAllocations.push(...rows);
        }
    }

    // 8. Ambil PO yang layak. fulfilled_qty dihitung dari po_lot_allocations (bukan po_batch_allocations lagi)
    let openPoDetails = [];
    if (productIds.length > 0) {
        for (const part of chunk(productIds, 500)) {
            const [rows] = await queryable.query(
                `SELECT
                    pd.po_detail_id,
                    pd.po_header_id,
                    pd.id_product,
                    pd.base_qty,
                    COALESCE((
                        SELECT SUM(pla.allocated_qty)
                        FROM po_lot_allocations pla
                        WHERE pla.po_detail_id = pd.po_detail_id AND pla.status <> 'Canceled'
                    ), 0) AS fulfilled_qty,
                    pd.status AS detail_status,
                    ph.po_number,
                    DATE_FORMAT(ph.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                    ph.status AS header_status,
                    p.product_code,
                    p.product_name
                 FROM po_details pd
                 JOIN po_headers ph ON pd.po_header_id = ph.po_header_id
                 JOIN products p ON pd.id_product = p.id_product
                 WHERE pd.deleted_at IS NULL
                   AND ph.status IN ('Approved', 'Production Completed')
                   AND pd.status IN ('Active', 'Close Requested')
                   AND pd.id_product IN (?)
                 ORDER BY ph.created_at ASC, pd.po_detail_id ASC`,
                [part]
            );
            openPoDetails.push(...rows);
        }
    }

    return {
        existingHashes,
        openPoDetails,
        allProducts,
        context: { 
            existingBatches, 
            existingLots, 
            existingAllocations 
        }
    };
};

module.exports = { loadProductionLotContext };
