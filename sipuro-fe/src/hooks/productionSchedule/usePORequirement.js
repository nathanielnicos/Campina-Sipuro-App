import { useState, useEffect, useCallback } from 'react';
import {
    fetchPORequirementSummary,
    fetchPORequirementDetail,
    fetchCustomersList,
    createDraftPO
} from '../../services/poRequirementApi';

export const usePORequirement = () => {
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

    // Handler yang sudah disesuaikan untuk membersihkan pemisah ribuan
    const handleRequiredQtyChange = (id_product, value) => {
        // Hapus semua karakter non-digit (titik, koma, huruf, dll)
        const cleanVal = value.replace(/\D/g, '');
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
            alert('Silakan isi nilai Required PO (Pcs) setidaknya pada satu produk.');
            return;
        }

        try {
            const custRes = await fetchCustomersList();
            if (custRes.success && custRes.data.length > 0) {
                setCustomers(custRes.data);
                setSelectedCustomerId(custRes.data[0].customer_id);
            }
            setIsConfirmModalOpen(true);
        } catch (error) {
            alert('Gagal mengambil daftar customer.');
        }
    };

    // Eksekusi Submit Draft PO
    const handleConfirmSubmitPO = async () => {
        const itemsToCreate = data.filter(item => item.required_po_qty > 0);

        if (!selectedCustomerId) {
            alert('Pilih customer terlebih dahulu!');
            return;
        }

        setCreatingPO(true);
        try {
            const res = await createDraftPO({
                customer_id: selectedCustomerId,
                items: itemsToCreate
            });

            if (res.success) {
                alert(res.message);
                setIsConfirmModalOpen(false);
                loadPORequirementSummary();
            }
        } catch (error) {
            console.error('Error creating Draft PO:', error);
            alert(error.response?.data?.message || 'Gagal membuat Draft PO.');
        } finally {
            setCreatingPO(false);
        }
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
        handleConfirmSubmitPO,
        creatingPO
    };
};
