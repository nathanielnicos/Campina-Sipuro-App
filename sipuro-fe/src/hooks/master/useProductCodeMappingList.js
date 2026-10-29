import { useState, useEffect, useCallback, useRef } from 'react';
import { getProductCodeMappings, setProductCodeMappingStatus } from '../../services/productCodeMappingApi';
import { useGlobalModal } from '../../context/ModalContext';

export const useProductCodeMappingList = () => {
    const { showAlert, showConfirm } = useGlobalModal();

    const [mappings, setMappings] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [busyId, setBusyId] = useState(null);
    const [addOpen, setAddOpen] = useState(false);

    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Hanya jawaban permintaan terbaru yang boleh mengisi tabel.
    const requestIdRef = useRef(0);

    const fetchMappings = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        try {
            setLoadingData(true);
            const res = await getProductCodeMappings(currentPage, pageSize, search);
            if (requestId !== requestIdRef.current) return;
            if (res.success) {
                setMappings(res.data);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages);
                    setTotalItems(res.pagination.totalItems);
                }
            }
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error('Failed to fetch product code mappings:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: err.response?.data?.message || 'Failed to fetch product code mappings.'
            });
        } finally {
            if (requestId === requestIdRef.current) setLoadingData(false);
        }
    }, [currentPage, pageSize, search, showAlert]);

    useEffect(() => {
        fetchMappings();
    }, [fetchMappings]);

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleResetFilter = () => {
        setSearch('');
        setCurrentPage(1);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
    };

    const handleLimitChange = (newLimit) => {
        setPageSize(newLimit);
        setCurrentPage(1);
    };

    const applyStatus = async (mapping, nextActive) => {
        setBusyId(mapping.id);
        try {
            const res = await setProductCodeMappingStatus(mapping.id, nextActive);
            showAlert({
                type: 'success',
                title: 'Success',
                message: res.message || `Mapping ${nextActive ? 'activated' : 'deactivated'}.`
            });
            fetchMappings();
        } catch (err) {
            showAlert({
                type: 'error',
                title: 'Failed',
                message: err.response?.data?.message || 'Failed to change mapping status.'
            });
        } finally {
            setBusyId(null);
        }
    };

    const handleToggleStatus = (mapping, currentlyActive) => {
        const nextActive = !currentlyActive;
        const pair = `${mapping.old_product.product_code} → ${mapping.new_product.product_code}`;
        showConfirm({
            title: nextActive ? 'Activate Mapping' : 'Deactivate Mapping',
            message: nextActive
                ? `Activate the mapping ${pair}? Future allocations may use it to fill POs across these product codes.`
                : `Deactivate the mapping ${pair}? Future allocations will no longer link these product codes. Existing allocations are not changed.`,
            confirmText: nextActive ? 'Activate' : 'Deactivate',
            isDanger: !nextActive,
            onConfirm: () => applyStatus(mapping, nextActive)
        });
    };

    const handleCreated = (res) => {
        setAddOpen(false);
        showAlert({
            type: 'success',
            title: 'Success',
            message: res?.message || 'Mapping created.'
        });
        // Pasangan baru ada di urutan terbaru: tampilkan dari halaman pertama tanpa filter.
        if (currentPage === 1 && search === '') {
            fetchMappings();
        } else {
            setSearch('');
            setCurrentPage(1);
        }
    };

    return {
        mappings,
        loadingData,
        busyId,
        addOpen,
        setAddOpen,
        search,
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        handleSearchChange,
        handleResetFilter,
        handlePageChange,
        handleLimitChange,
        handleToggleStatus,
        handleCreated
    };
};
