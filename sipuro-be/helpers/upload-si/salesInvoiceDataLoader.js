const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const loadSalesInvoiceContext = async (queryable, rows, { forUpdate = false } = {}) => {
    const lock = forUpdate ? ' FOR UPDATE' : '';

    // 1. Ambil master produk
    const [allProducts] = await queryable.query(
        'SELECT id_product, product_code, product_name, pcs_per_ctn FROM products'
    );
    const productByCode = new Map(allProducts.map(p => [String(p.product_code).trim().toUpperCase(), p]));

    // 2. Ambil hash SI yang sudah ada di database (Cek duplikasi)
    const existingHashes = new Set();
    const [savedSiHashes] = await queryable.query('SELECT row_hash FROM sales_invoices');
    savedSiHashes.forEach(r => existingHashes.add(r.row_hash));

    // 3. Ambil nomor DO yang ada di file Excel
    const doNumbers = [...new Set(rows.map(r => r.doNumber).filter(Boolean))];
    let existingDeliveryOrders = [];

    if (doNumbers.length > 0) {
        for (const part of chunk(doNumbers, 500)) {
            const [foundDos] = await queryable.query(
                `SELECT 
                    d.id AS delivery_order_id, 
                    d.do_number, 
                    d.product_id, 
                    d.qty_pcs, 
                    d.qty_ctn, 
                    d.do_created_date,
                    p.product_code
                 FROM delivery_orders d
                 JOIN products p ON d.product_id = p.id_product
                 WHERE d.do_number IN (?)${lock}`,
                [part]
            );
            existingDeliveryOrders.push(...foundDos);
        }
    }

    return {
        allProducts,
        productByCode,
        existingHashes,
        existingDeliveryOrders
    };
};

module.exports = { loadSalesInvoiceContext };
