import { useState, useEffect } from 'react';
import { unformatThousand } from '../../../utils/formatters';
import { PO_ITEMS_PAGE_SIZE, PO_STATUS } from '../../../constants/po';
import { toCents, fromCents, calcLineTotal, deriveUnitCents } from '../../../utils/money';

const generateUniqueId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const createInitialItem = () => ({
    row_id: generateUniqueId(),
    id_product: '',
    product_code: '',
    product_name: '',
    qty: 1,
    base_price: 0,
    unit_price: 0,
    base_uom: '',
    selected_uom: '',
    pcs_per_ctn: 1,
    ctn_per_plt: 1,
    total_price: 0,
    price_changed: false,
    price_unavailable: false,
    old_unit_price: null,
    locked_product_id: null,
    locked_unit_cents: 0
});

export const usePODRow = ({ rawPoItems = [], products = [], isCustomer = true, poStatus = '' }) => {
    const [items, setItems] = useState([createInitialItem()]);
    // Teks pencarian produk dan dropdown yang terbuka dikunci dengan row_id (bukan nomor baris),
    // sehingga tetap benar saat baris dihapus atau urutan berubah.
    const [searchTerm, setSearchTerm] = useState({});
    const [openDropdown, setOpenDropdown] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(PO_ITEMS_PAGE_SIZE);

    // Mappings data items saat rawPoItems atau products berubah
    useEffect(() => {
        if (rawPoItems && rawPoItems.length > 0) {
            const initialSearch = {};

            const mappedItems = rawPoItems.map((item) => {
                const rowId = generateUniqueId();
                const productId = item.id_product || item.product_id;
                const masterProd = products.find((p) => String(p.id_product) === String(productId));

                const baseUom = item.base_uom || masterProd?.base_uom || 'PCS';
                const selectedUom = item.uom || item.selected_uom || baseUom;
                const pcsPerCtn = Number(item.pcs_per_ctn || masterProd?.pcs_per_ctn || 1);
                const ctnPerPlt = Number(item.ctn_per_plt || masterProd?.ctn_per_plt || 1);
                const currentQty = parseInt(item.qty, 10) || 1;

                // Harga yang tersimpan di PO (hanya tersedia untuk Customer) dan harga aktif hari ini.
                const storedUnitCents = deriveUnitCents(item);
                const masterCents = toCents(masterProd?.base_price);

                // Draft diperlakukan seperti keranjang: semua baris memakai harga hari ini dan
                // perubahan harga diberitahukan. Status lain memakai harga yang sudah tersimpan
                // (terkunci), sama dengan aturan di server.
                const isDraftPo = isCustomer && poStatus === PO_STATUS.DRAFT;
                const isLockedPo = isCustomer && poStatus === PO_STATUS.WAITING;

                let unitCents = storedUnitCents;
                let priceChanged = false;
                let priceUnavailable = false;
                if (isDraftPo) {
                    if (masterCents > 0) {
                        unitCents = masterCents;
                        priceChanged = storedUnitCents > 0 && masterCents !== storedUnitCents;
                    } else {
                        priceUnavailable = true;
                    }
                }
                const hasLockedPrice = isLockedPo && storedUnitCents > 0;

                const productCode = item.product_code || masterProd?.product_code || '';
                const productName = item.product_name || masterProd?.product_name || '';

                if (productCode || productName) {
                    initialSearch[rowId] = isCustomer
                        ? productName
                        : `${productCode} - ${productName}`;
                }

                return {
                    row_id: rowId,
                    po_detail_id: item.po_detail_id || item.id,
                    id_product: productId,
                    product_code: productCode,
                    product_name: productName,
                    qty: currentQty,
                    base_price: fromCents(unitCents),
                    unit_price: fromCents(unitCents),
                    base_uom: baseUom,
                    selected_uom: selectedUom,
                    pcs_per_ctn: pcsPerCtn,
                    ctn_per_plt: ctnPerPlt,
                    total_price: calcLineTotal(unitCents, currentQty),
                    price_changed: priceChanged,
                    price_unavailable: priceUnavailable,
                    old_unit_price: priceChanged ? fromCents(storedUnitCents) : null,
                    locked_product_id: hasLockedPrice ? productId : null,
                    locked_unit_cents: hasLockedPrice ? storedUnitCents : 0
                };
            });

            setItems(mappedItems);
            setSearchTerm(initialSearch);
        }
    }, [rawPoItems, products, isCustomer, poStatus]);

    const handleSelectProduct = (index, prod) => {
        const baseUom = prod.base_uom || 'PCS';

        // Pembaruan imutabel: objek baris lama tidak diubah, hanya diganti dengan salinan baru.
        setItems((prevItems) => prevItems.map((row, i) => {
            if (i !== index) return row;
            const currentQty = row.qty || 1;

            // PO yang sudah diajukan: bila produk asli baris ini dipilih kembali, harga terkunci
            // yang lama tetap dipakai (server melakukan hal yang sama). Selain itu harga hari ini.
            const keepLockedPrice = row.po_detail_id
                && row.locked_unit_cents > 0
                && String(row.locked_product_id) === String(prod.id_product);
            const unitCents = keepLockedPrice ? row.locked_unit_cents : toCents(prod.base_price);

            return {
                ...row,
                id_product: prod.id_product,
                product_code: prod.product_code,
                product_name: prod.product_name,
                base_price: fromCents(unitCents),
                unit_price: fromCents(unitCents),
                base_uom: baseUom,
                selected_uom: baseUom,
                pcs_per_ctn: prod.pcs_per_ctn || 1,
                ctn_per_plt: prod.ctn_per_plt || 1,
                total_price: calcLineTotal(unitCents, currentQty),
                price_changed: false,
                price_unavailable: false,
                old_unit_price: null
            };
        }));
        const displayLabel = isCustomer ? prod.product_name : `${prod.product_code} - ${prod.product_name}`;
        const rowId = items[index]?.row_id;
        if (rowId) {
            setSearchTerm(prev => ({ ...prev, [rowId]: displayLabel }));
        }
        setOpenDropdown(null);
    };

    // Handler Qty menggunakan unformatThousand dari utils/formatters
    const handleQtyChange = (index, rawValue) => {
        const cleanNumber = unformatThousand(rawValue);
        const qty = parseInt(cleanNumber, 10) || 0;

        // Pembaruan imutabel: baris yang berubah diganti salinan baru (objek lama tidak dimutasi).
        setItems((prevItems) => prevItems.map((row, i) => (
            i === index
                ? { ...row, qty, total_price: calcLineTotal(toCents(row.unit_price), qty) }
                : row
        )));
    };

    const handleAddItem = () => {
        setItems(prevItems => [...prevItems, createInitialItem()]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;

        const removedRowId = items[index]?.row_id;
        const updatedItems = items.filter((_, i) => i !== index);

        // Sesuaikan halaman pagination jika halaman saat ini menjadi kosong setelah item dihapus
        const newTotalPages = Math.ceil(updatedItems.length / pageSize) || 1;
        if (currentPage > newTotalPages) {
            setCurrentPage(newTotalPages);
        }

        // Cukup buang teks milik baris yang dihapus; baris lain tidak terpengaruh
        setSearchTerm((prev) => {
            const next = { ...prev };
            delete next[removedRowId];
            return next;
        });
        setItems(updatedItems);
        setOpenDropdown(null);
    };

    const totalPages = Math.ceil(items.length / pageSize) || 1;
    const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return {
        items,
        searchTerm,
        setSearchTerm,
        openDropdown,
        setOpenDropdown,
        currentPage,
        setCurrentPage,
        pageSize,
        setPageSize,
        totalPages,
        paginatedItems,
        handleSelectProduct,
        handleQtyChange,
        handleAddItem,
        handleRemoveItem
    };
};
