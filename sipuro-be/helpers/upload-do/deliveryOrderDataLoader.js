const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const loadDeliveryOrderContext = async (queryable, rawRows, { forUpdate = false } = {}) => {
    const lock = forUpdate ? ' FOR UPDATE' : '';

    const [allProducts] = await queryable.query(
        'SELECT id_product, product_code, product_name, pcs_per_ctn FROM products'
    );

    // Hash yang sudah ada di tabel upload log DO
    const existingHashes = [];
    const uniqueHashes = [...new Set(rawRows.map((r) => r.rowHash))];
    for (const part of chunk(uniqueHashes, 500)) {
        const [rows] = await queryable.query(
            'SELECT DISTINCT row_hash FROM delivery_order_upload_details WHERE row_hash IN (?)',
            [part]
        );
        rows.forEach((r) => existingHashes.push(r.row_hash));
    }

    // Ambil master Lot yang cocok dengan nomor lot di file
    const lotNumbers = [...new Set(rawRows.map((r) => r.lotNumber).filter(Boolean))];
    let existingLots = [];
    if (lotNumbers.length > 0) {
        for (const part of chunk(lotNumbers, 500)) {
            const [rows] = await queryable.query(
                `SELECT id, lot_number, id_product, actual_completed_datetime 
                 FROM lots WHERE lot_number IN (?)`,
                [part]
            );
            existingLots.push(...rows);
        }
    }

    // Ambil po_lot_allocations aktif untuk lot tersebut
    let openLotAllocations = [];
    const lotIds = existingLots.map((l) => l.id);
    if (lotIds.length > 0) {
        for (const part of chunk(lotIds, 500)) {
            const [rows] = await queryable.query(
                `SELECT 
                    pla.id AS po_lot_allocation_id,
                    pla.po_detail_id,
                    pla.lot_id,
                    pla.allocated_qty,
                    -- Hitung akumulasi yang sudah dikirim di DO sebelumnya
                    COALESCE((
                        SELECT SUM(doa.qty_pcs) 
                        FROM delivery_order_allocations doa 
                        WHERE doa.po_lot_allocation_id = pla.id
                    ), 0) AS already_delivered_qty,
                    pla.status AS allocation_status,
                    pd.id_product,
                    pd.base_qty,
                    pd.delivered_qty,
                    ph.po_header_id,
                    ph.po_number,
                    ph.description AS customer_po_text,
                    DATE_FORMAT(ph.created_at, '%Y-%m-%d %H:%i:%s') AS po_created_date,
                    l.lot_number,
                    l.actual_completed_datetime,
                    p.product_code,
                    p.pcs_per_ctn
                FROM po_lot_allocations pla
                JOIN po_details pd ON pla.po_detail_id = pd.po_detail_id
                JOIN po_headers ph ON pd.po_header_id = ph.po_header_id
                JOIN lots l ON pla.lot_id = l.id
                JOIN products p ON pd.id_product = p.id_product
                WHERE pla.lot_id IN (?)
                    AND pla.status <> 'Canceled'
                    AND pd.deleted_at IS NULL
                    AND ph.status IN ('Approved', 'Production Completed')
                ORDER BY ph.created_at ASC, pla.id ASC${lock}`,
                [part]
            );
            openLotAllocations.push(...rows);
        }
    }

    return {
        allProducts,
        existingHashes,
        existingLots,
        openLotAllocations
    };
};

module.exports = {
    loadDeliveryOrderContext
};
