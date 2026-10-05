import { useState, useCallback } from 'react';
import { fetchAllocationLogsApi } from '../../../services/batchApi';

export const useAllocationHistoryModal = () => {
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedAllocation, setSelectedAllocation] = useState(null);
    const [historyLogs, setHistoryLogs] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPagination, setHistoryPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        limit: 10
    });

    const loadLogs = useCallback(async (allocationId, page = 1, limit = 10) => {
        if (!allocationId) return;
        setHistoryLoading(true);
        try {
            const res = await fetchAllocationLogsApi(allocationId, page, limit);
            if (res && res.success) {
                setHistoryLogs(res.data || []);
                if (res.pagination) {
                    setHistoryPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            }
        } catch (error) {
            console.error('Error loading history logs:', error);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const handleOpenHistoryModal = (allocationRow) => {
        setSelectedAllocation(allocationRow);
        setIsHistoryModalOpen(true);
        const allocId = allocationRow?.allocation_id || allocationRow?.id;
        loadLogs(allocId, 1, 10);
    };

    const handleCloseHistoryModal = () => {
        setIsHistoryModalOpen(false);
        setSelectedAllocation(null);
        setHistoryLogs([]);
    };

    const handlePageChange = (newPage) => {
        const allocId = selectedAllocation?.allocation_id || selectedAllocation?.id;
        loadLogs(allocId, newPage, historyPagination.limit);
    };

    const handleLimitChange = (newLimit) => {
        const allocId = selectedAllocation?.allocation_id || selectedAllocation?.id;
        loadLogs(allocId, 1, newLimit);
    };

    return {
        isHistoryModalOpen,
        selectedAllocation,
        historyLogs,
        historyLoading,
        historyPagination,
        handleOpenHistoryModal,
        handleCloseHistoryModal,
        handlePageChange,
        handleLimitChange
    };
};

export default useAllocationHistoryModal;
