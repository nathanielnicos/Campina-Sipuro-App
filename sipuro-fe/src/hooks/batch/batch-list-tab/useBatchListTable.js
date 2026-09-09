import { useState, useEffect, useCallback } from 'react';
import { fetchBatchMapping, exportBatchExcelApi, updateAllocationStatusApi } from '../../../services/batchApi';

export const useBatchListTable = (currentUser, reloadTrigger, onRefreshAll) => {
    // State Data & API
    const [mappingList, setMappingList] = useState([]);
    const [poTolerance, setPoTolerance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // State Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [batchStatus, setBatchStatus] = useState('');

    // State Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    // State View Mode & Export
    const [viewMode, setViewMode] = useState(currentUser?.role === 'CUSTOMER' ? 'PO' : 'BATCH');
    const [exporting, setExporting] = useState(false);

    // Fetch Data
    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = { search: searchQuery, fromDate, toDate, batchStatus };
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
    }, [page, limit, searchQuery, fromDate, toDate, batchStatus]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    // Handlers
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setPage(1);
    };

    const handleFromDateChange = (e) => {
        setFromDate(e.target.value);
        setPage(1);
    };

    const handleToDateChange = (e) => {
        setToDate(e.target.value);
        setPage(1);
    };

    const handleStatusChange = (e) => {
        setBatchStatus(e.target.value);
        setPage(1);
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setFromDate('');
        setToDate('');
        setBatchStatus('');
        setPage(1);
    };

    const handleExportExcel = async () => {
        setExporting(true);
        const res = await exportBatchExcelApi({
            search: searchQuery,
            fromDate,
            toDate,
            batchStatus
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

    // Transformasi Data khusus untuk Mode Tampilan PO
    const getPoGroupedData = useCallback(() => {
        const poMap = {};

        mappingList.forEach((row) => {
            const allocations = Array.isArray(row.po_allocations) && row.po_allocations.length > 0
                ? row.po_allocations
                : [];

            allocations.forEach((po) => {
                const poNum = po.po_number || '-';
                const productCode = row.product_code || '-';

                if (!poMap[poNum]) {
                    poMap[poNum] = {
                        po_number: poNum,
                        totalRowCount: 0,
                        skus: {}
                    };
                }

                if (!poMap[poNum].skus[productCode]) {
                    poMap[poNum].skus[productCode] = {
                        product_code: productCode,
                        product_name: row.product_name,
                        batches: []
                    };
                }

                poMap[poNum].skus[productCode].batches.push({
                    allocation_id: po.allocation_id,
                    batch_number: row.batch_number,
                    plan_production_date: row.plan_production_date,
                    batch_status: row.batch_status,
                    allocated_qty: Number(po.allocated_qty) || 0,
                    fulfilled_qty: Number(po.fulfilled_qty) || 0,
                    status: po.status || '-'
                });

                poMap[poNum].totalRowCount += 1;
            });
        });

        return Object.values(poMap);
    }, [mappingList]);

    return {
        mappingList,
        poTolerance,
        loading,
        error,
        searchQuery,
        fromDate,
        toDate,
        batchStatus,
        pagination,
        viewMode,
        exporting,
        setPage,
        setLimit,
        setViewMode,
        handleSearchChange,
        handleFromDateChange,
        handleToDateChange,
        handleStatusChange,
        handleResetFilters,
        handleExportExcel,
        handleUpdateStatus,
        getPoGroupedData
    };
};
