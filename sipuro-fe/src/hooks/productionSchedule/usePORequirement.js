import { useState, useEffect, useCallback } from 'react';
import {
    fetchPORequirementSummary,
    fetchPORequirementDetail,
    fetchCustomersList,
    createDraftPO
} from '../../services/poRequirementApi';
import { useGlobalModal } from '../../context/ModalContext';
import { unformatThousand } from '../../utils/formatters';

export const usePORequirement = () => {
    // Modal Global Context
    const { showConfirm, showAlert } = useGlobalModal();

    const [search, setSearch] = useState('');
    const [startWeek, setStartWeek] = useState('2026-W39');
    const [endWeek, setEndWeek] = useState('2026-W47');

    const [data, setData] = useState([]);
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal Detail
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [modalData, setModalData] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);

    // Modal Confirm Draft PO
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('');

    // State untuk deskripsi Draft PO
    const [description, setDescription] = useState('');

    const [creatingPO, setCreatingPO] = useState(false);

    const loadPORequirementSummary = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchPORequirementSummary({
                search: search.trim(),
                start_week: startWeek,
                end_week: endWeek
            });

            if (res.success) {
                setData(res.data || []);
                setWeeks(res.weeks || []);
            }
        } catch (error) {
            console.error('Error fetching PO Requirement Summary:', error);
        } finally {
            setLoading(false);
        }
    }, [search, startWeek, endWeek]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadPORequirementSummary();
        }, 300);

        return () => clearTimeout(timer);
    }, [loadPORequirementSummary]);

    // Handler untuk membersihkan pemisah ribuan menggunakan unformatThousand
    const handleRequiredQtyChange = (id_product, value) => {
        const cleanVal = unformatThousand(value);
        const numericVal = cleanVal === '' ? 0 : parseInt(cleanVal, 10);

        setData(prevData =>
            prevData.map(item =>
                item.id_product === id_product
                    ? { ...item, required_po_qty: numericVal }
                    : item
            )
        );
    };

    const openDetailModal = async (product) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
        setModalLoading(true);

        try {
            const res = await fetchPORequirementDetail(product.id_product, {
                start_week: startWeek,
                end_week: endWeek
            });

            if (res.success) {
                setModalData(res);
            }
        } catch (error) {
            console.error('Error fetching PO Requirement Detail:', error);
        } finally {
            setModalLoading(false);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedProduct(null);
        setModalData(null);
    };

    // Pemicu Klik Tombol Create Draft PO
    const handleInitCreateDraftPO = async () => {
        const itemsToCreate = data.filter(item => item.required_po_qty > 0);

        if (itemsToCreate.length === 0) {
            showAlert({
                type: 'warning',
                title: 'Validation Error',
                message: 'Please enter Required PO (Pcs) for at least one product.'
            });
            return;
        }

        try {
            const custRes = await fetchCustomersList();
            if (custRes.success && custRes.data.length > 0) {
                setCustomers(custRes.data);
                setSelectedCustomerId(custRes.data[0].customer_id);
            }

            // Reset description setiap kali modal konfirmasi dibuka
            setDescription('');
            setIsConfirmModalOpen(true);
        } catch (error) {
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'Failed to fetch customers list.'
            });
        }
    };

    // Fungsi internal eksekusi API Submit Draft PO
    const executeSubmitPO = async (itemsToCreate) => {
        setCreatingPO(true);
        try {
            const res = await createDraftPO({
                customer_id: selectedCustomerId,
                items: itemsToCreate,
                description: description
            });

            if (res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Draft PO created successfully!'
                });
                setIsConfirmModalOpen(false);
                setDescription('');
                loadPORequirementSummary();
            }
        } catch (error) {
            console.error('Error creating Draft PO:', error);
            showAlert({
                type: 'error',
                title: 'Error',
                message: error.response?.data?.message || 'Failed to create Draft PO.'
            });
        } finally {
            setCreatingPO(false);
        }
    };

    // Eksekusi Submit Draft PO dengan modal konfirmasi global
    const handleConfirmSubmitPO = () => {
        const itemsToCreate = data.filter(item => item.required_po_qty > 0);

        if (!selectedCustomerId) {
            showAlert({
                type: 'warning',
                title: 'Selection Required',
                message: 'Please select a customer first!'
            });
            return;
        }

        showConfirm({
            title: 'Create Draft PO',
            message: 'Are you sure you want to create this Draft PO?',
            confirmText: 'Create Draft PO',
            onConfirm: () => executeSubmitPO(itemsToCreate)
        });
    };

    return {
        search,
        setSearch,
        startWeek,
        setStartWeek,
        endWeek,
        setEndWeek,
        data,
        weeks,
        loading,
        handleRequiredQtyChange,
        isModalOpen,
        selectedProduct,
        modalData,
        modalLoading,
        openDetailModal,
        closeModal,
        handleInitCreateDraftPO,
        isConfirmModalOpen,
        setIsConfirmModalOpen,
        customers,
        selectedCustomerId,
        setSelectedCustomerId,
        description,
        setDescription,
        handleConfirmSubmitPO,
        creatingPO
    };
};
