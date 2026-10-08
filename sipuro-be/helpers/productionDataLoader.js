/**
 * Memuat seluruh data database yang dibutuhkan calculator.
 * Dipakai oleh preview (tanpa lock) dan commit (dengan lock FOR UPDATE di dalam transaksi),
 * sehingga keduanya menghitung dari bentuk data yang sama.
 *
 * Catatan commit: transaksi dijalankan dengan READ COMMITTED agar pembacaan setelah lock
 * selalu melihat data terbaru.
 */
const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const loadProductionContext = async (queryable, rawRows, { forUpdate = false } = {}) => {
    const lock = forUpdate ? ' FOR UPDATE' : '';

    const [allProducts] = await queryable.query(
        'SELECT id_product, product_code, product_name FROM products'
    );

    // Hash yang sudah ada di DB (hanya yang ada di file)
    const existingHashes = [];
    const uniqueHashes = [...new Set(rawRows.map((r) => r.rowHash))];
    for (const part of chunk(uniqueHashes, 500)) {
        const [rows] = await queryable.query(
            'SELECT DISTINCT row_hash FROM production_upload_details WHERE row_hash IN (?)',
            [part]
        );
        rows.forEach((r) => existingHashes.push(r.row_hash));
    }

    // Produk yang ada di file
    const codesInFile = new Set(rawRows.map((r) => r.itemCode));
    const productIds = allProducts
        .filter((p) => codesInFile.has(p.product_code))
        .map((p) => p.id_product);

    // Batch yang sudah ada
    const batchNumbers = [...new Set(rawRows.map((r) => r.batchNumber))];
    let existingBatches = [];
    if (batchNumbers.length > 0) {
        [existingBatches] = await queryable.query(
            'SELECT id, batch_number, id_product FROM batches WHERE batch_number IN (?)',
            [batchNumbers]
        );
    }

    // Lock berurutan (po_details -> po_batch_allocations) agar tidak deadlock antar-commit
    if (forUpdate && productIds.length > 0) {
        await queryable.query(
            `SELECT po_detail_id FROM po_details
             WHERE id_product IN (?) AND deleted_at IS NULL AND status IN ('Active', 'Close Requested')
             ORDER BY po_detail_id${lock}`,
            [productIds]
        );
    }

    let existingAllocations = [];
    if (existingBatches.length > 0) {
        [existingAllocations] = await queryable.query(
            `SELECT id, po_detail_id, id_batch, allocated_qty, status
             FROM po_batch_allocations
             WHERE id_batch IN (?)
             ORDER BY id${lock}`,
            [existingBatches.map((b) => b.id)]
        );
    }

    // PO yang layak. fulfilled_qty dihitung dari alokasi (sama dengan rumus refreshPODetailFulfilledQty).
    // created_at diambil sebagai string agar tidak tergantung timezone server (lokal vs Vercel).
    let openPoDetails = [];
    if (productIds.length > 0) {
        [openPoDetails] = await queryable.query(
            `SELECT
                pd.po_detail_id,
                pd.po_header_id,
                pd.id_product,
                pd.base_qty,
                COALESCE((
                    SELECT SUM(pba.allocated_qty)
                    FROM po_batch_allocations pba
                    WHERE pba.po_detail_id = pd.po_detail_id AND pba.status <> 'Canceled'
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
            [productIds]
        );
    }

    return {
        existingHashes,
        openPoDetails,
        allProducts,
        context: { existingBatches, existingAllocations }
    };
};

module.exports = { loadProductionContext };
