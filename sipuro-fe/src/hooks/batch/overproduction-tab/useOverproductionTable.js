import { useState, useEffect, useCallback } from 'react';
import { fetchUnallocatedStocks, fetchOpenAllocationsByProduct, reallocateStockApi } from '../../../services/batchApi';

export const useOverproductionTable = (currentUser, reloadTrigger, onRefreshAll) => {
    // State Data, Loading, Error
    const [unallocatedList, setUnallocatedList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // State Filter
    const [searchStock, setSearchStock] = useState('');
    const [fromProdDate, setFromProdDate] = useState('');
    const [toProdDate, setToProdDate] = useState('');

    // State Sorting
    const [sortKey, setSortKey] = useState('');
    const [sortOrder, setSortOrder] = useState('DESC');

    // State Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    // State Modal Alokasi
    const [selectedStock, setSelectedStock] = useState(null);
    const [openAllocations, setOpenAllocations] = useState([]);
    const [targetAllocId, setTargetAllocId] = useState('');
    const [qtyToAllocate, setQtyToAllocate] = useState('');
    const [loadingAlloc, setLoadingAlloc] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Fetch Data API Lebihan Stok
    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = {
                searchStock,
                fromProdDate,
                toProdDate,
                sortKey,
                sortOrder
            };
            const res = await fetchUnallocatedStocks(page, limit, filters);
            if (res && res.success) {
                setUnallocatedList(res.data || []);
                if (res.pagination) {
                    setPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            } else {
                setError(res?.message || 'Failed to fetch overproduction data.');
            }
        } catch (err) {
            setError('An error occurred while loading data.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, searchStock, fromProdDate, toProdDate, sortKey, sortOrder]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    // Handlers Filter
    const handleStockSearchChange = (e) => {
        setSearchStock(e.target.value);
        setPage(1);
    };

    const handleFromProdDateChange = (e) => {
        setFromProdDate(e.target.value);
        setPage(1);
    };

    const handleToProdDateChange = (e) => {
        setToProdDate(e.target.value);
        setPage(1);
    };

    const handleSort = (key, order) => {
        setSortKey(key);
        setSortOrder(order);
        setPage(1);
    };

    const handleResetFilters = () => {
        setSearchStock('');
        setFromProdDate('');
        setToProdDate('');
        setSortKey('');
        setSortOrder('DESC');
        setPage(1);
    };

    // Handlers Modal & Reallocate
    const handleOpenModal = async (stock) => {
        setSelectedStock(stock);
        setQtyToAllocate(stock.qty_available);
        setTargetAllocId('');
        setLoadingAlloc(true);

        const res = await fetchOpenAllocationsByProduct(stock.id_product);
        if (res && res.success) {
            setOpenAllocations(res.data || []);
        } else {
            setOpenAllocations([]);
        }
        setLoadingAlloc(false);
    };

    const handleCloseModal = () => {
        setSelectedStock(null);
        setOpenAllocations([]);
        setTargetAllocId('');
        setQtyToAllocate('');
    };

    const handleSubmitReallocate = async (e) => {
        e.preventDefault();
        if (!targetAllocId) return alert('Select the target PO / Batch to supply.');
        const inputQty = Number(qtyToAllocate);
        if (!inputQty || inputQty <= 0) return alert('Allocated quantity must be greater than 0.');
        if (inputQty > selectedStock.qty_available) return alert('Allocated quantity exceeds available overproduction stock.');

        if (!window.confirm('Are you sure you want to move this overproduction stock to the selected target batch/PO?')) {
            return;
        }

        const currentUserId = currentUser?.employee_id || currentUser?.id;

        const payload = {
            unallocatedId: selectedStock.id,
            targetAllocationId: targetAllocId,
            allocateQty: inputQty,
            userId: currentUserId
        };

        setSubmitting(true);
        const res = await reallocateStockApi(payload);
        setSubmitting(false);

        if (res && res.success) {
            alert(res.message);
            handleCloseModal();
            loadData();
            if (onRefreshAll) onRefreshAll();
        } else {
            alert('Allocation Failed: ' + (res?.message || 'An error occurred.'));
        }
    };

    return {
        unallocatedList,
        loading,
        error,
        searchStock,
        fromProdDate,
        toProdDate,
        sortKey,
        sortOrder,
        pagination,
        selectedStock,
        openAllocations,
        targetAllocId,
        qtyToAllocate,
        loadingAlloc,
        submitting,
        setPage,
        setLimit,
        setTargetAllocId,
        setQtyToAllocate,
        handleStockSearchChange,
        handleFromProdDateChange,
        handleToProdDateChange,
        handleResetFilters,
        handleSort,
        handleOpenModal,
        handleCloseModal,
        handleSubmitReallocate
    };
};
