import { useState, useEffect, useCallback } from 'react';
import { fetchBatchMapping, updateAllocationStatusApi } from '../../../services/batchApi';
import { useGlobalModal } from '../../../context/ModalContext';

export const useAllocatedBatchTable = (currentUser, reloadTrigger, onRefreshAll, filterState, viewMode) => {
    const { showConfirm, showAlert } = useGlobalModal();

    // Data State
    const [mappingList, setMappingList] = useState([]);
    const [poTolerance, setPoTolerance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Sorting State
    const [sortKey, setSortKey] = useState('');
    const [sortOrder, setSortOrder] = useState('ASC');

    // Pagination State
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    // Destructure filter values secara individual untuk mencegah infinite re-render
    const searchQuery = filterState?.searchQuery || '';
    const batchStatus = filterState?.batchStatus || '';
    const fromActualDate = filterState?.fromActualDate || '';
    const toActualDate = filterState?.toActualDate || '';
    const fromCreatedDate = filterState?.fromCreatedDate || '';
    const toCreatedDate = filterState?.toCreatedDate || '';

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = {
                search: searchQuery,
                batchStatus: batchStatus,
                displayMode: viewMode === 'PO' ? 'BY_PO' : 'BY_BATCH',
                fromActualDate,
                toActualDate,
                fromCreatedDate,
                toCreatedDate,
                sortKey,
                sortOrder
            };

            const res = await fetchBatchMapping(page, limit, filters);
            if (res && res.success) {
                setMappingList(res.data || []);
                setPoTolerance(res.poTolerance ?? null);
                if (res.pagination) {
                    setPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            } else {
                setError(res?.message || 'Failed to fetch batch mapping history.');
            }
        } catch (err) {
            setError('An error occurred while loading data.');
        } finally {
            setLoading(false);
        }
    }, [
        page, limit, viewMode, sortKey, sortOrder,
        searchQuery, batchStatus, fromActualDate, toActualDate,
        fromCreatedDate, toCreatedDate
    ]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    // Reset pagination dan sorting saat viewMode berpindah
    useEffect(() => {
        setPage(1);
        setSortKey('');
        setSortOrder('ASC');
    }, [viewMode]);

    const handleSort = (key, order) => {
        setSortKey(key);
        setSortOrder(order);
        setPage(1);
    };

    const resetSortingAndPage = () => {
        setSortKey('');
        setSortOrder('ASC');
        setPage(1);
    };

    // Force Close Allocation
    const executeForceClose = async (allocationId, reason = '') => {
        setLoading(true);
        try {
            const userId = currentUser?.id || null;
            const res = await updateAllocationStatusApi(allocationId, {
                action: 'FORCE_CLOSE',
                reason,
                userId
            });
            if (res && res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Allocation status force closed successfully.'
                });
                if (onRefreshAll) {
                    onRefreshAll();
                } else {
                    loadData();
                }
            } else {
                showAlert({
                    type: 'error',
                    title: 'Failed',
                    message: res?.message || 'Failed to force close allocation status.'
                });
            }
        } catch (err) {
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'A system error occurred while updating allocation status.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleForceClose = (allocationId) => {
        showConfirm({
            title: 'Force Close Allocation',
            message: 'Are you sure you want to force close this batch allocation?',
            confirmText: 'Confirm Force Close',
            onConfirm: () => executeForceClose(allocationId, '')
        });
    };

    return {
        mappingList,
        poTolerance,
        loading,
        error,
        sortKey,
        sortOrder,
        page,
        limit,
        pagination,
        setPage,
        setLimit,
        handleSort,
        resetSortingAndPage,
        handleForceClose,
        refreshData: loadData
    };
};

export default useAllocatedBatchTable;
