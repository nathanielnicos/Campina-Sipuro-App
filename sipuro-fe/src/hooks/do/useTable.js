import { useState, useEffect, useCallback } from 'react';
import { getDeliveryOrders } from '../../services/doApi';

export const useTable = ({
    currentPage,
    setCurrentPage,
    search,
    startDate,
    endDate,
    completedStartDate,
    completedEndDate,
    sortBy,
    sortOrder
}) => {
    const [doList, setDoList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState(null);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const fetchData = useCallback(async () => {
        // Jika belum ada data sama sekali, tampilkan loading utama. Jika sudah ada, gunakan indikator fetching.
        setFetching(true);
        setError(null);

        try {
            const params = {
                page: currentPage,
                limit: pageSize,
                search,
                startDate,
                endDate,
                completedStartDate,
                completedEndDate,
                sortBy,
                sortOrder
            };

            const res = await getDeliveryOrders(params);

            if (res.success) {
                setDoList(res.data || []);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages || 1);
                    setTotalItems(res.pagination.totalItems || 0);
                }
            } else {
                setError(res.message || 'Failed to load delivery orders');
            }
        } catch (err) {
            console.error('Error fetching delivery orders:', err);
            setError(err.message || 'Server connection error');
        } finally {
            setLoading(false);
            setFetching(false);
        }
    }, [
        currentPage,
        pageSize,
        search,
        startDate,
        endDate,
        completedStartDate,
        completedEndDate,
        sortBy,
        sortOrder
    ]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleLimitChange = (newLimit) => {
        setPageSize(newLimit);
        setCurrentPage(1);
    };

    return {
        doList,
        loading,
        fetching,
        error,
        pageSize,
        totalPages,
        totalItems,
        handlePageChange,
        handleLimitChange,
        refreshData: fetchData
    };
};
