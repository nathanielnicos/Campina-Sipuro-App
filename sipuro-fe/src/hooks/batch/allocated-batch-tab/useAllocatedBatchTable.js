import { useState, useEffect, useCallback } from 'react';
import {
    fetchBatchMapping,
    exportBatchExcelApi,
    updateAllocationStatusApi,
    updateAllocationQtyApi
} from '../../../services/batchApi';
import { useGlobalModal } from '../../../context/ModalContext';
import { formatQty } from '../../../utils/formatters';

export const useAllocatedBatchTable = (currentUser, reloadTrigger, onRefreshAll) => {
    // Modal Global Context
    const { showConfirm, showAlert } = useGlobalModal();

    // State Data & API
    const [mappingList, setMappingList] = useState([]);
    const [poTolerance, setPoTolerance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // State View Mode
    const [viewMode, setViewMode] = useState(currentUser?.role === 'CUSTOMER' ? 'PO' : 'BATCH');

    // State Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [batchStatus, setBatchStatus] = useState('');

    // State Tanggal Range
    const [fromActualDate, setFromActualDate] = useState('');
    const [toActualDate, setToActualDate] = useState('');
    const [fromCreatedDate, setFromCreatedDate] = useState('');
    const [toCreatedDate, setToCreatedDate] = useState('');

    // State Sorting
    const [sortKey, setSortKey] = useState('');
    const [sortOrder, setSortOrder] = useState('ASC');

    // State Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    const [exporting, setExporting] = useState(false);

    // --- State Modal Edit Allocated Qty ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedAllocation, setSelectedAllocation] = useState(null);
    const [editLoading, setEditLoading] = useState(false);

    // Fetch Data dari API
    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = {
                search: searchQuery,
                batchStatus,
                displayMode: viewMode === 'PO' ? 'BY_PO' : 'BY_BATCH',
                fromActualDate, toActualDate,
                fromCreatedDate, toCreatedDate,
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
        page, limit, searchQuery, batchStatus, viewMode,
        fromActualDate, toActualDate,
        fromCreatedDate, toCreatedDate,
        sortKey, sortOrder
    ]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    // Handler pergantian View Mode
    const handleViewModeChange = (newMode) => {
        if (newMode !== viewMode) {
            setViewMode(newMode);
            setSortKey('');
            setSortOrder('ASC');
            setPage(1);
        }
    };

    // Handlers Filter & Sort
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setPage(1);
    };

    const handleStatusChange = (e) => {
        setBatchStatus(e.target.value);
        setPage(1);
    };

    const handleSort = (key, order) => {
        setSortKey(key);
        setSortOrder(order);
        setPage(1);
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setBatchStatus('');
        setFromActualDate('');
        setToActualDate('');
        setFromCreatedDate('');
        setToCreatedDate('');
        setSortKey('');
        setSortOrder('ASC');
        setPage(1);
    };

    const handleExportExcel = async () => {
        setExporting(true);
        const res = await exportBatchExcelApi({
            search: searchQuery,
            batchStatus,
            displayMode: viewMode === 'PO' ? 'BY_PO' : 'BY_BATCH',
            fromActualDate, toActualDate,
            fromCreatedDate, toCreatedDate,
        });
        setExporting(false);

        if (!res.success) {
            showAlert({
                type: 'error',
                title: 'Export Failed',
                message: res.message || 'Failed to export Excel file.'
            });
        }
    };

    // Handler Force Close Allocation Status
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

    // --- Handlers Edit Allocated Qty ---
    const handleOpenEditQty = (allocationRow) => {
        setSelectedAllocation(allocationRow);
        setIsEditModalOpen(true);
    };

    const handleCloseEditQty = () => {
        setSelectedAllocation(null);
        setIsEditModalOpen(false);
    };

    const executeSaveQty = async (allocationId, newAllocatedQty, reason = '') => {
        setEditLoading(true);
        try {
            const userId = currentUser?.id || null;
            const res = await updateAllocationQtyApi(allocationId, {
                newAllocatedQty,
                reason,
                userId
            });
            if (res && res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Allocated quantity updated successfully.'
                });
                handleCloseEditQty();
                if (onRefreshAll) {
                    onRefreshAll();
                } else {
                    loadData();
                }
            } else {
                showAlert({
                    type: 'error',
                    title: 'Failed',
                    message: res?.message || 'Failed to update allocated quantity.'
                });
            }
        } catch (err) {
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'A system error occurred while updating allocated quantity.'
            });
        } finally {
            setEditLoading(false);
        }
    };

    const handleSaveQty = (allocationId, newAllocatedQty, reason) => {
        showConfirm({
            title: 'Update Allocated Quantity',
            message: `Are you sure you want to update allocated quantity to ${formatQty(newAllocatedQty)}?`,
            confirmText: 'Save Changes',
            onConfirm: () => executeSaveQty(allocationId, newAllocatedQty, reason)
        });
    };

    return {
        mappingList,
        poTolerance,
        loading,
        error,
        searchQuery,
        batchStatus,
        fromActualDate, setFromActualDate,
        toActualDate, setToActualDate,
        fromCreatedDate, setFromCreatedDate,
        toCreatedDate, setToCreatedDate,
        sortKey,
        sortOrder,
        pagination,
        viewMode,
        exporting,
        setPage,
        setLimit,
        setViewMode: handleViewModeChange,
        handleSearchChange,
        handleStatusChange,
        handleSort,
        handleResetFilters,
        handleExportExcel,
        handleForceClose,

        // Expose state & handler modal edit Qty
        isEditModalOpen,
        selectedAllocation,
        editLoading,
        handleOpenEditQty,
        handleCloseEditQty,
        handleSaveQty
    };
};

export default useAllocatedBatchTable;
