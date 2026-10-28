import { useState, useCallback, useRef } from 'react';
import { fetchLotAllocationLogsApi } from '../../../services/productionLotApi';

const EMPTY_PAGINATION = { currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 };

export const useAllocationHistory = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedAllocation, setSelectedAllocation] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState(EMPTY_PAGINATION);

    // Nomor permintaan terakhir: respons yang terlambat (mis. modal sudah ditutup) diabaikan
    const requestRef = useRef(0);

    const loadLogs = useCallback(async (allocationId, page = 1, limit = 10) => {
        if (!allocationId) return;
        const requestId = ++requestRef.current;
        setLoading(true);
        setError('');

        const res = await fetchLotAllocationLogsApi(allocationId, page, limit);
        if (requestId !== requestRef.current) return;

        if (res && res.success) {
            setLogs(res.data || []);
            if (res.pagination) {
                setPagination({
                    currentPage: Number(res.pagination.currentPage) || 1,
                    totalPages: Number(res.pagination.totalPages) || 1,
                    totalItems: Number(res.pagination.totalItems) || 0,
                    limit: Number(res.pagination.limit) || 10
                });
            }
        } else {
            setLogs([]);
            setError(res?.message || 'Failed to fetch allocation history.');
        }
        setLoading(false);
    }, []);

    const handleOpen = (allocation) => {
        setSelectedAllocation(allocation);
        setIsOpen(true);
        setLogs([]);
        setPagination(EMPTY_PAGINATION);
        loadLogs(allocation?.allocation_id, 1, 10);
    };

    const handleClose = () => {
        requestRef.current += 1;
        setIsOpen(false);
        setSelectedAllocation(null);
        setLogs([]);
        setError('');
        setLoading(false);
    };

    const handlePageChange = (newPage) => {
        loadLogs(selectedAllocation?.allocation_id, newPage, pagination.limit);
    };

    const handleLimitChange = (newLimit) => {
        loadLogs(selectedAllocation?.allocation_id, 1, newLimit);
    };

    return {
        isOpen,
        selectedAllocation,
        logs,
        loading,
        error,
        pagination,
        handleOpen,
        handleClose,
        handlePageChange,
        handleLimitChange
    };
};

export default useAllocationHistory;
