import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    fetchPORequirementSummary,
    fetchPORequirementDetail,
    fetchCustomersList,
    createDraftPO
} from '../../services/poRequirementApi';
import { useGlobalModal } from '../../context/ModalContext';
import { setRequiredQty, listRequiredItems, toDraftPayload } from '../../utils/requiredQty';
import { getDefaultWeekRange, isValidWeekRange } from '../../utils/weekRange';

export const usePORequirement = () => {
    // Modal Global Context
    const { showConfirm, showAlert } = useGlobalModal();

    const [search, setSearch] = useState('');
    const [weekRange, setWeekRange] = useState(() => getDefaultWeekRange());
    const { startWeek, endWeek } = weekRange;
    const handleWeekRangeChange = useCallback((newStart, newEnd) => {
        setWeekRange({ startWeek: newStart, endWeek: newEnd });
    }, []);

    // Hanya respons dari permintaan terakhir yang boleh mengubah tampilan.
    const summaryRequestRef = useRef(0);
    const detailRequestRef = useRef(0);

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
        if (!isValidWeekRange(startWeek, endWeek)) return;
        const requestId = ++summaryRequestRef.current;
        setLoading(true);
        try {
            const res = await fetchPORequirementSummary({
                search: search.trim(),
                start_week: startWeek,
                end_week: endWeek
            });

            if (requestId !== summaryRequestRef.current) return;
            if (res.success) {
                setData(res.data || []);
                setWeeks(res.weeks || []);
            }
        } catch (error) {
            console.error('Error fetching PO Requirement Summary:', error);
        } finally {
            if (requestId === summaryRequestRef.current) setLoading(false);
        }
    }, [search, startWeek, endWeek]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadPORequirementSummary();
        }, 300);

        return () => clearTimeout(timer);
    }, [loadPORequirementSummary]);

    // Required PO disimpan terpisah dari data tabel agar tidak hilang saat tabel dimuat ulang
    // (pencarian, ganti rentang minggu).
    const [requiredItems, setRequiredItems] = useState({});

    const handleRequiredQtyChange = useCallback((product, value) => {
        setRequiredItems((prev) => setRequiredQty(prev, product, value));
    }, []);

    const confirmItems = useMemo(() => listRequiredItems(requiredItems), [requiredItems]);

    const openDetailModal = useCallback(async (product) => {
        setSelectedProduct(product);
        setIsModalOpen(true);
        setModalLoading(true);
        const requestId = ++detailRequestRef.current;

        try {
            const res = await fetchPORequirementDetail(product.id_product, {
                start_week: startWeek,
                end_week: endWeek
            });

            if (requestId !== detailRequestRef.current) return;
            if (res.success) {
                setModalData(res);
            }
        } catch (error) {
            console.error('Error fetching PO Requirement Detail:', error);
        } finally {
            if (requestId === detailRequestRef.current) setModalLoading(false);
        }
    }, [startWeek, endWeek]);

    const closeModal = () => {
        detailRequestRef.current += 1; // abaikan respons detail yang masih berjalan
        setIsModalOpen(false);
        setSelectedProduct(null);
        setModalData(null);
    };

    // Pemicu Klik Tombol Create Draft PO
    const handleInitCreateDraftPO = async () => {
        if (confirmItems.length === 0) {
            showAlert({
                type: 'warning',
                title: 'Validation Error',
                message: 'Please enter Required PO (Pcs) for at least one product.'
            });
            return;
        }

        try {
            const custRes = await fetchCustomersList();
            const customerList = custRes.success ? custRes.data : [];
            setCustomers(customerList);
            // Satu-satunya customer langsung terpilih; jika lebih dari satu, harus dipilih secara sadar.
            setSelectedCustomerId(customerList.length === 1 ? String(customerList[0].customer_id) : '');

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
                setRequiredItems({});
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
        const itemsToCreate = toDraftPayload(confirmItems);

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
        endWeek,
        handleWeekRangeChange,
        data,
        weeks,
        loading,
        requiredItems,
        confirmItems,
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
