// Daftar "Required PO (Pcs)" yang diisi PPIC, disimpan terpisah dari data tabel
// sehingga tidak hilang saat pencarian atau rentang minggu berubah (data tabel dimuat ulang).
// Bentuk: { [id_product]: { id_product, product_code, product_name, required_po_qty } }

export const MAX_REQUIRED_QTY = 999999999;

// Memasang qty satu produk. Nilai kosong atau 0 menghapus produk dari daftar.
export const setRequiredQty = (items, product, rawValue) => {
    const digits = String(rawValue === null || rawValue === undefined ? '' : rawValue).replace(/\D/g, '').slice(0, 9);
    const qty = digits ? Math.min(parseInt(digits, 10), MAX_REQUIRED_QTY) : 0;

    const next = { ...items };
    if (qty > 0) {
        next[product.id_product] = {
            id_product: product.id_product,
            product_code: product.product_code,
            product_name: product.product_name,
            required_po_qty: qty
        };
    } else {
        delete next[product.id_product];
    }
    return next;
};

export const getRequiredQty = (items, idProduct) => (
    (items[idProduct] && items[idProduct].required_po_qty) || 0
);

// Daftar terurut kode produk, untuk ditampilkan di modal konfirmasi.
export const listRequiredItems = (items) => (
    Object.values(items).sort((a, b) => String(a.product_code).localeCompare(String(b.product_code)))
);

// Bentuk yang dikirim ke server.
export const toDraftPayload = (items) => (
    items.map(({ id_product, required_po_qty }) => ({ id_product, required_po_qty }))
);
