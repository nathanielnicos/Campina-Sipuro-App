import { useState, useEffect, useCallback } from 'react';
import {
    fetchProducts,
    fetchCustomerDetail,
    fetchCompanyProfile,
    fetchPODetail,
    savePO,
    cancelPOApi,
    updatePOStatusApi
} from '../../../services/poApi';

const initialItemState = {
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
};

export const usePOModal = ({ poId, currentUser, onSuccess }) => {
    const userRole = currentUser?.role;

    // customerId untuk ID Perusahaan / Tenant
    const customerId = userRole === 'CUSTOMER' ? (currentUser?.customer_id || currentUser?.id) : null;

    // customerUserId khusus untuk ID Pengguna Customer (Customer User)
    const customerUserId = userRole === 'CUSTOMER' ? (currentUser?.customer_user_id || currentUser?.user_id || currentUser?.id) : null;

    // employeeId khusus untuk ID Karyawan PPIC / Admin
    const employeeId = userRole !== 'CUSTOMER' ? (currentUser?.employee_id || currentUser?.user_id || currentUser?.id) : null;

    const [poCode, setPoCode] = useState('');
    const [poStatus, setPoStatus] = useState('');
    const [products, setProducts] = useState([]);
    const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [description, setDescription] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [items, setItems] = useState([{ ...initialItemState }]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState({});
    const [openDropdown, setOpenDropdown] = useState(null);
    const [ppnPercent, setPpnPercent] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const isCustomer = userRole !== 'PPIC';

    const loadPODetailData = useCallback(async (catalogProducts = []) => {
        if (!poId) return;
        try {
            const poRes = await fetchPODetail(poId);
            if (poRes.success && poRes.data) {
                const poHeader = poRes.data.header || {};
                const poItems = poRes.data.items || [];

                setPoStatus(poHeader.status || '');
                setPoCode(poHeader.po_number || poHeader.po_code || poHeader.po_no || `#${poId}`);

                if (poHeader.requested_delivery_date) {
                    const d = new Date(poHeader.requested_delivery_date);
                    setRequestedDeliveryDate(d.toISOString().split('T')[0]);
                }
                setDeliveryAddress(poHeader.delivery_address || '');
                setDescription(poHeader.description || '');
                setRejectionReason(poHeader.rejection_reason || '');

                if (poItems.length > 0) {
                    const mappedItems = poItems.map(item => {
                        const productId = item.id_product || item.product_id;
                        const masterProd = catalogProducts.find(p => String(p.id_product) === String(productId));

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

                        return {
                            po_detail_id: item.po_detail_id || item.id,
                            id_product: productId,
                            product_code: item.product_code || masterProd?.product_code || '',
                            product_name: item.product_name || masterProd?.product_name || '',
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

                    const initialSearch = {};
                    mappedItems.forEach((itm, idx) => {
                        if (itm.product_code || itm.product_name) {
                            initialSearch[idx] = isCustomer
                                ? itm.product_name
                                : `${itm.product_code} - ${itm.product_name}`;
                        }
                    });
                    setSearchTerm(initialSearch);
                }
            } else {
                setError(poRes.message || 'Failed to load PO details.');
            }
        } catch (err) {
            console.error('Error fetching PO detail:', err);
            setError('Failed to load PO details from server.');
        }
    }, [poId, isCustomer]);

    useEffect(() => {
        const initData = async () => {
            try {
                let currentProducts = [];
                const prodRes = await fetchProducts();
                if (prodRes.success) {
                    currentProducts = prodRes.data || [];
                    setProducts(currentProducts);
                } else {
                    setError('Failed to load product catalog.');
                }

                if (customerId) {
                    const custRes = await fetchCustomerDetail(customerId);
                    if (custRes.success && custRes.data) {
                        setDeliveryAddress(custRes.data.delivery_address || '');
                    }
                }

                const profileRes = await fetchCompanyProfile();
                if (profileRes.success && profileRes.data?.ppn_percent !== undefined) {
                    setPpnPercent(profileRes.data.ppn_percent);
                } else {
                    setError(profileRes.message || 'Failed to load VAT rate.');
                }

                if (poId) {
                    await loadPODetailData(currentProducts);
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to connect to the server.');
            }
        };

        initData();
    }, [customerId, poId, loadPODetailData]);

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
        setSearchTerm({ ...searchTerm, [index]: displayLabel });
        setOpenDropdown(null);
    };

    const handleQtyChange = (index, rawValue) => {
        const cleanNumber = String(rawValue).replace(/\./g, '').replace(/\D/g, '');
        const qty = parseInt(cleanNumber, 10) || 0;

        const updatedItems = [...items];
        const item = updatedItems[index];
        item.qty = qty;
        item.total_price = (item.unit_price || 0) * qty;

        setItems(updatedItems);
    };

    const handleAddItem = () => setItems([...items, { ...initialItemState }]);

    const handleRemoveItem = (index) => {
        if (items.length === 1) return;
        const updatedItems = items.filter((_, i) => i !== index);
        const newSearchTerm = { ...searchTerm };
        delete newSearchTerm[index];
        setSearchTerm(newSearchTerm);
        setItems(updatedItems);
    };

    const subtotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const taxAmount = subtotal * (ppnPercent / 100);
    const grandTotal = subtotal + taxAmount;

    const totalPages = Math.ceil(items.length / pageSize) || 1;
    const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!requestedDeliveryDate) {
            alert('Delivery date is required!');
            return;
        }

        const invalidItem = items.find((i) => !i.id_product || i.qty <= 0);
        if (invalidItem) {
            alert('Please select a product and ensure Quantity is greater than 0 for all rows.');
            return;
        }

        const confirmMsg = poId ? 'Are you sure you want to save changes to this PO?' : 'Are you sure you want to create this new PO?';
        if (!window.confirm(confirmMsg)) return;

        const payload = {
            customer_id: customerId,
            ...(poId ? { updated_by: customerUserId } : { created_by: customerUserId }),
            requested_delivery_date: requestedDeliveryDate,
            delivery_address: deliveryAddress,
            description,
            subtotal,
            tax_amount: taxAmount,
            grand_total: grandTotal,
            items: items.map(item => ({
                po_detail_id: item.po_detail_id || undefined,
                id_product: item.id_product,
                qty: Number(item.qty),
                selected_uom: item.selected_uom,
                unit_price: item.unit_price,
                total_price: item.total_price
            }))
        };

        try {
            setLoading(true);
            const result = await savePO(poId, payload);
            if (result.success) {
                alert(poId ? 'PO updated successfully!' : 'PO created successfully!');
                if (onSuccess) onSuccess();
            } else {
                alert('Failed to save PO: ' + (result.message || 'An error occurred.'));
            }
        } catch (err) {
            console.error('Error submitting PO:', err);
            alert('A connection error occurred while saving the PO.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelPO = async () => {
        if (!window.confirm('Are you sure you want to cancel this PO?')) return;

        try {
            setLoading(true);
            const result = await cancelPOApi(poId, customerUserId);
            if (result.success) {
                alert('PO cancelled successfully!');
                if (onSuccess) onSuccess();
            } else {
                alert('Failed to cancel PO: ' + result.message);
            }
        } catch (err) {
            console.error('Error canceling PO:', err);
            alert('An error occurred while cancelling the PO.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus) => {
        let notes = '';
        if (newStatus === 'Rejected') {
            const inputNotes = prompt('Enter rejection reason (Maximum 50 characters):');
            if (inputNotes === null) return;

            const trimmedNotes = inputNotes.trim();
            if (!trimmedNotes) {
                alert('Rejection reason is required!');
                return;
            }
            if (trimmedNotes.length > 50) {
                alert(`Rejection reason is too long (${trimmedNotes.length} characters). Maximum 50 characters!`);
                return;
            }
            notes = trimmedNotes;

            if (!window.confirm('Are you sure you want to REJECT this PO?')) return;
        } else if (newStatus === 'Waiting for Batch Assignment') {
            if (!window.confirm('Are you sure you want to APPROVE this PO?')) return;
        } else {
            if (!window.confirm(`Are you sure you want to change PO status to ${newStatus}?`)) return;
        }

        try {
            setLoading(true);
            const result = await updatePOStatusApi(poId, newStatus, notes, employeeId);

            if (result.success) {
                if (newStatus === 'Rejected') alert('PO rejected successfully!');
                else if (newStatus === 'Waiting for Batch Assignment') alert('PO approved successfully!');
                else alert(`PO status successfully updated to ${newStatus}!`);

                if (onSuccess) onSuccess();
            } else {
                alert(result.message || 'Failed to update PO status.');
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('A server connection error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return {
        poCode,
        poStatus,
        products,
        requestedDeliveryDate,
        setRequestedDeliveryDate,
        deliveryAddress,
        description,
        setDescription,
        rejectionReason,
        items,
        loading,
        error,
        searchTerm,
        setSearchTerm,
        openDropdown,
        setOpenDropdown,
        ppnPercent,
        currentPage,
        setCurrentPage,
        pageSize,
        setPageSize,
        totalPages,
        paginatedItems,
        subtotal,
        taxAmount,
        grandTotal,
        handleSelectProduct,
        handleQtyChange,
        handleAddItem,
        handleRemoveItem,
        handleSubmit,
        handleCancelPO,
        handleUpdateStatus
    };
};
