import { useState, useEffect } from 'react';

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
    total_price: 0
});

export const useItemRow = ({ rawPoItems = [], products = [], isCustomer = true }) => {
    const [items, setItems] = useState([createInitialItem()]);
    const [searchTerm, setSearchTerm] = useState({});
    const [openDropdown, setOpenDropdown] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Mappings data items saat rawPoItems atau products berubah
    useEffect(() => {
        if (rawPoItems && rawPoItems.length > 0) {
            const initialSearch = {};

            const mappedItems = rawPoItems.map((item, idx) => {
                const productId = item.id_product || item.product_id;
                const masterProd = products.find((p) => String(p.id_product) === String(productId));

                const baseUom = item.base_uom || masterProd?.base_uom || 'PCS';
                const selectedUom = item.uom || item.selected_uom || baseUom;
                const pcsPerCtn = Number(item.pcs_per_ctn || masterProd?.pcs_per_ctn || 1);
                const ctnPerPlt = Number(item.ctn_per_plt || masterProd?.ctn_per_plt || 1);
                const currentQty = parseInt(item.qty, 10) || 1;
                const totalPrice = parseFloat(item.total_price) || 0;

                let unitPrice = parseFloat(item.unit_price) || 0;
                if (unitPrice === 0 && totalPrice > 0 && currentQty > 0) {
                    unitPrice = totalPrice / currentQty;
                }

                let pureBasePrice = 0;
                if (masterProd && parseFloat(masterProd.base_price) > 0) {
                    pureBasePrice = parseFloat(masterProd.base_price);
                } else if (parseFloat(item.base_price) > 0) {
                    pureBasePrice = parseFloat(item.base_price);
                } else {
                    if (selectedUom === 'CTN' && pcsPerCtn > 0) {
                        pureBasePrice = unitPrice / pcsPerCtn;
                    } else if (selectedUom === 'PLT' && pcsPerCtn > 0 && ctnPerPlt > 0) {
                        pureBasePrice = unitPrice / (pcsPerCtn * ctnPerPlt);
                    } else {
                        pureBasePrice = unitPrice;
                    }
                }

                const productCode = item.product_code || masterProd?.product_code || '';
                const productName = item.product_name || masterProd?.product_name || '';

                if (productCode || productName) {
                    initialSearch[idx] = isCustomer
                        ? productName
                        : `${productCode} - ${productName}`;
                }

                return {
                    row_id: generateUniqueId(),
                    po_detail_id: item.po_detail_id || item.id,
                    id_product: productId,
                    product_code: productCode,
                    product_name: productName,
                    qty: currentQty,
                    base_price: pureBasePrice,
                    unit_price: unitPrice,
                    base_uom: baseUom,
                    selected_uom: selectedUom,
                    pcs_per_ctn: pcsPerCtn,
                    ctn_per_plt: ctnPerPlt,
                    total_price: totalPrice || (unitPrice * currentQty)
                };
            });

            setItems(mappedItems);
            setSearchTerm(initialSearch);
        }
    }, [rawPoItems, products, isCustomer]);

    const handleSelectProduct = (index, prod) => {
        const basePrice = parseFloat(prod.base_price) || 0;
        const currentQty = items[index]?.qty || 1;
        const baseUom = prod.base_uom || 'PCS';

        const updatedItems = [...items];
        updatedItems[index] = {
            ...updatedItems[index],
            id_product: prod.id_product,
            product_code: prod.product_code,
            product_name: prod.product_name,
            base_price: basePrice,
            unit_price: basePrice,
            base_uom: baseUom,
            selected_uom: baseUom,
            pcs_per_ctn: prod.pcs_per_ctn || 1,
            ctn_per_plt: prod.ctn_per_plt || 1,
            total_price: basePrice * currentQty
        };

        setItems(updatedItems);
        const displayLabel = isCustomer ? prod.product_name : `${prod.product_code} - ${prod.product_name}`;
        setSearchTerm(prev => ({ ...prev, [index]: displayLabel }));
        setOpenDropdown(null);
    };

    const handleQtyChange = (index, rawValue) => {
        const cleanNumber = String(rawValue).replace(/\./g, '').replace(/\D/g, '');
        const qty = parseInt(cleanNumber, 10) || 0;

        const updatedItems = [...items];
        const item = updatedItems[index];
        if (item) {
            item.qty = qty;
            item.total_price = (item.unit_price || 0) * qty;
            setItems(updatedItems);
        }
    };

    const handleAddItem = () => {
        setItems(prevItems => [...prevItems, createInitialItem()]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;

        const updatedItems = items.filter((_, i) => i !== index);

        // Re-index searchTerm agar baris yang bergeser ke atas tetap mempertahankan label pengetikannya
        const newSearchTerm = {};
        updatedItems.forEach((itm, newIdx) => {
            const oldIdx = newIdx >= index ? newIdx + 1 : newIdx;
            if (searchTerm[oldIdx] !== undefined) {
                newSearchTerm[newIdx] = searchTerm[oldIdx];
            } else if (itm.product_name || itm.product_code) {
                newSearchTerm[newIdx] = isCustomer
                    ? itm.product_name
                    : `${itm.product_code} - ${itm.product_name}`;
            }
        });

        // Sesuaikan halaman pagination jika halaman saat ini menjadi kosong setelah item dihapus
        const newTotalPages = Math.ceil(updatedItems.length / pageSize) || 1;
        if (currentPage > newTotalPages) {
            setCurrentPage(newTotalPages);
        }

        setSearchTerm(newSearchTerm);
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
