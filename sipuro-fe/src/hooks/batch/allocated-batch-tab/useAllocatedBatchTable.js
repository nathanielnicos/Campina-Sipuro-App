import { useState, useEffect, useCallback } from 'react';
import { fetchBatchMapping, exportBatchExcelApi, updateAllocationStatusApi, updateBatchNumberApi } from '../../../services/batchApi';

export const useAllocatedBatchTable = (currentUser, reloadTrigger, onRefreshAll) => {
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

    // State 4 Tanggal Range
    const [fromPlanDate, setFromPlanDate] = useState('');
    const [toPlanDate, setToPlanDate] = useState('');
    const [fromActualDate, setFromActualDate] = useState('');
    const [toActualDate, setToActualDate] = useState('');
    const [fromCreatedDate, setFromCreatedDate] = useState('');
    const [toCreatedDate, setToCreatedDate] = useState('');
    const [fromDeliveryDate, setFromDeliveryDate] = useState('');
    const [toDeliveryDate, setToDeliveryDate] = useState('');

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
                fromPlanDate, toPlanDate,
                fromActualDate, toActualDate,
                fromCreatedDate, toCreatedDate,
                fromDeliveryDate, toDeliveryDate,
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
        fromPlanDate, toPlanDate, fromActualDate, toActualDate,
        fromCreatedDate, toCreatedDate, fromDeliveryDate, toDeliveryDate,
        sortKey, sortOrder
    ]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    // Handlers Existing
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
        setFromPlanDate('');
        setToPlanDate('');
        setFromActualDate('');
        setToActualDate('');
        setFromCreatedDate('');
        setToCreatedDate('');
        setFromDeliveryDate('');
        setToDeliveryDate('');
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
            fromPlanDate, toPlanDate,
            fromActualDate, toActualDate,
            fromCreatedDate, toCreatedDate,
            fromDeliveryDate, toDeliveryDate
        });
        setExporting(false);

        if (!res.success) {
            alert(res.message);
        }
    };

    const handleUpdateStatus = async (allocationId, action) => {
        const actionText = action === 'CANCEL' ? 'cancel' : 'force close';
        const reason = window.prompt(`Are you sure you want to ${actionText} this batch allocation?\nEnter reason (optional):`);

        if (reason === null) return;

        setLoading(true);
        try {
            const res = await updateAllocationStatusApi(allocationId, { action, reason });
            if (res && res.success) {
                alert(res.message || 'Allocation status updated successfully.');
                if (onRefreshAll) {
                    onRefreshAll();
                } else {
                    loadData();
                }
            } else {
                alert('Failed: ' + (res?.message || 'Failed to update allocation status.'));
            }
        } catch (err) {
            alert('A system error occurred while updating the status.');
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers Baru: Rename Batch ---
    const handleOpenEditBatch = (batchRow) => {
        setSelectedBatch(batchRow);
        setIsEditModalOpen(true);
    };

    const handleCloseEditBatch = () => {
        setSelectedBatch(null);
        setIsEditModalOpen(false);
    };

    const handleSaveBatchNumber = async (batchId, newBatchNumber) => {
        // Konfirmasi sebelum mengeksekusi update
        const confirmSave = window.confirm(`Are you sure you want to rename this batch number to "${newBatchNumber}"?`);
        if (!confirmSave) return;

        setEditLoading(true);
        try {
            const res = await updateBatchNumberApi(batchId, { newBatchNumber });
            if (res && res.success) {
                alert(res.message || 'Batch number successfully updated.');
                handleCloseEditBatch();
                loadData();
            } else {
                alert(res?.message || 'Failed to update batch number.');
            }
        } catch (err) {
            alert('A system error occurred while updating batch number.');
        } finally {
            setEditLoading(false);
        }
    };

    return {
        mappingList,
        poTolerance,
        loading,
        error,
        searchQuery,
        batchStatus,
        fromPlanDate, setFromPlanDate,
        toPlanDate, setToPlanDate,
        fromActualDate, setFromActualDate,
        toActualDate, setToActualDate,
        fromCreatedDate, setFromCreatedDate,
        toCreatedDate, setToCreatedDate,
        fromDeliveryDate, setFromDeliveryDate,
        toDeliveryDate, setToDeliveryDate,
        sortKey,
        sortOrder,
        pagination,
        viewMode,
        exporting,
        setPage,
        setLimit,
        setViewMode,
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
