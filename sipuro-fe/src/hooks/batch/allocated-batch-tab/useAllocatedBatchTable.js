import { useState, useEffect, useCallback } from 'react';
import { fetchBatchMapping, exportBatchExcelApi, updateAllocationStatusApi, updateBatchNumberApi } from '../../../services/batchApi';
import { useGlobalModal } from '../../../context/ModalContext';

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

    // State 3 Tanggal Range (Plan Date Dihapus)
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

    // --- State Baru: Modal Rename Batch ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState(null);
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

    // Handler pergantian View Mode (Reset Page & Sort)
    const handleViewModeChange = (newMode) => {
        if (newMode !== viewMode) {
            setViewMode(newMode);
            setSortKey('');
            setSortOrder('ASC');
            setPage(1);
        }
    };

    // Handlers
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

    // Internal execution function for updating allocation status
    const executeUpdateStatus = async (allocationId, action, reason) => {
        setLoading(true);
        try {
            const res = await updateAllocationStatusApi(allocationId, { action, reason });
            if (res && res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Allocation status updated successfully.'
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
                    message: res?.message || 'Failed to update allocation status.'
                });
            }
        } catch (err) {
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'A system error occurred while updating the status.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = (allocationId, action) => {
        const actionText = action === 'CANCEL' ? 'cancel' : 'force close';

        showConfirm({
            title: `Update Status (${action})`,
            message: `Are you sure you want to ${actionText} this batch allocation?`,
            confirmText: 'Confirm',
            onConfirm: () => executeUpdateStatus(allocationId, action, '')
        });
    };

    // --- Handlers Rename Batch ---
    const handleOpenEditBatch = (batchRow) => {
        setSelectedBatch(batchRow);
        setIsEditModalOpen(true);
    };

    const handleCloseEditBatch = () => {
        setSelectedBatch(null);
        setIsEditModalOpen(false);
    };

    const executeSaveBatchNumber = async (batchId, newBatchNumber) => {
        setEditLoading(true);
        try {
            const res = await updateBatchNumberApi(batchId, { newBatchNumber });
            if (res && res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Batch number successfully updated.'
                });
                handleCloseEditBatch();
                loadData();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Failed',
                    message: res?.message || 'Failed to update batch number.'
                });
            }
        } catch (err) {
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'A system error occurred while updating batch number.'
            });
        } finally {
            setEditLoading(false);
        }
    };

    const handleSaveBatchNumber = (batchId, newBatchNumber) => {
        showConfirm({
            title: 'Rename Batch Number',
            message: `Are you sure you want to rename this batch number to "${newBatchNumber}"?`,
            confirmText: 'Rename',
            onConfirm: () => executeSaveBatchNumber(batchId, newBatchNumber)
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
        handleUpdateStatus,

        // Expose state & handler modal
        isEditModalOpen,
        selectedBatch,
        editLoading,
        handleOpenEditBatch,
        handleCloseEditBatch,
        handleSaveBatchNumber
    };
};
