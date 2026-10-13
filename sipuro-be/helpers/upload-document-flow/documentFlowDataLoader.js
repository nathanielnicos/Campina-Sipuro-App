/**
 * Loads all database data needed by the calculator.
 * Used by the preview (no lock) and the commit (rows locked FOR UPDATE inside the transaction),
 * so both calculate from the same shape of data.
 *
 * Dates are fetched as strings with DATE_FORMAT so nothing depends on the server / driver timezone
 * (local MariaDB, Aiven MySQL, Vercel). The database stores WIB wall-clock values.
 *
 * Lock order matches the production upload: po_details first, then po_batch_allocations (by id).
 */
const { generateDoRowHash, generateSiRowHash } = require('./hashGeneratorHelper');
const { FIFO_DATE_SQL, EXCLUDED_ALLOCATION_STATUSES } = require('./fifoConfig');
const { INTERFACED_STATUS } = require('./documentFlowConfig');

const DATETIME_FORMAT = '%Y-%m-%d %H:%i:%s';

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const loadDocumentFlowContext = async (queryable, rows, { forUpdate = false } = {}) => {
    const lock = forUpdate ? ' FOR UPDATE' : '';

    const [allProducts] = await queryable.query(
        'SELECT id_product, product_code, product_name, pcs_per_ctn FROM products'
    );
    const productByCode = new Map();
    allProducts.forEach((p) => productByCode.set(String(p.product_code).trim().toUpperCase(), p));

    // Only Interfaced rows with a registered product are saved, so only those need DB checks
    const relevantRows = rows.filter((r) =>
        String(r.deliveryStatus || '').trim().toUpperCase() === INTERFACED_STATUS
        && r.itemCode && r.doNumber
        && productByCode.has(String(r.itemCode).trim().toUpperCase())
    );

    // Hashes that already exist in the database
    const doHashes = new Set();
    const siHashes = new Set();
    relevantRows.forEach((r) => {
        const product = productByCode.get(String(r.itemCode).trim().toUpperCase());
        doHashes.add(generateDoRowHash(r.doNumber, product.id_product));
        if (r.invoiceNumber) siHashes.add(generateSiRowHash(r.invoiceNumber, r.doNumber, product.id_product));
    });

    const existingHashes = [];
    for (const part of chunk([...doHashes], 500)) {
        const [found] = await queryable.query('SELECT row_hash FROM delivery_orders WHERE row_hash IN (?)', [part]);
        found.forEach((r) => existingHashes.push(r.row_hash));
    }
    for (const part of chunk([...siHashes], 500)) {
        const [found] = await queryable.query('SELECT row_hash FROM sales_invoices WHERE row_hash IN (?)', [part]);
        found.forEach((r) => existingHashes.push(r.row_hash));
    }

    // Registered POs (matching is done in the application, not in SQL, because the tables use
    // different collations)
    const [poRows] = await queryable.query('SELECT po_header_id, po_number FROM po_headers');

    // Allocations of the products in the file
    const productIds = [...new Set(relevantRows.map((r) => productByCode.get(String(r.itemCode).trim().toUpperCase()).id_product))];

    let allocations = [];
    if (productIds.length > 0) {
        if (forUpdate) {
            await queryable.query(
                `SELECT po_detail_id FROM po_details WHERE id_product IN (?) ORDER BY po_detail_id${lock}`,
                [productIds]
            );
            await queryable.query(
                `SELECT id FROM po_batch_allocations
                 WHERE status NOT IN (?)
                   AND po_detail_id IN (SELECT po_detail_id FROM po_details WHERE id_product IN (?))
                 ORDER BY id${lock}`,
                [EXCLUDED_ALLOCATION_STATUSES, productIds]
            );
        }

        [allocations] = await queryable.query(
            `SELECT
                pba.id AS allocation_id,
                pba.po_detail_id,
                pba.allocated_qty,
                pba.status AS allocation_status,
                pd.po_header_id,
                pd.id_product,
                ph.po_number,
                DATE_FORMAT(ph.created_at, '${DATETIME_FORMAT}') AS po_created_at,
                b.id AS batch_id,
                b.batch_number,
                DATE_FORMAT(b.actual_completed_date, '${DATETIME_FORMAT}') AS actual_completed_at,
                DATE_FORMAT(${FIFO_DATE_SQL}, '${DATETIME_FORMAT}') AS fifo_date,
                COALESCE((
                    SELECT SUM(doa.qty_pcs)
                    FROM delivery_order_allocations doa
                    WHERE doa.po_batch_allocation_id = pba.id
                ), 0) AS consumed_qty
             FROM po_batch_allocations pba
             JOIN po_details pd ON pd.po_detail_id = pba.po_detail_id
             JOIN po_headers ph ON ph.po_header_id = pd.po_header_id
             JOIN batches b ON b.id = pba.id_batch
             WHERE pba.status NOT IN (?)
               AND pd.id_product IN (?)
               AND ${FIFO_DATE_SQL} IS NOT NULL
             ORDER BY pba.id`,
            [EXCLUDED_ALLOCATION_STATUSES, productIds]
        );
    }

    const [[latestRow]] = await queryable.query(
        `SELECT DATE_FORMAT(MAX(do_created_date), '${DATETIME_FORMAT}') AS latest FROM delivery_orders`
    );

    return {
        allProducts,
        existingHashes,
        poRows,
        allocations,
        latestSavedDoAt: latestRow && latestRow.latest ? latestRow.latest : null
    };
};

module.exports = { loadDocumentFlowContext };
