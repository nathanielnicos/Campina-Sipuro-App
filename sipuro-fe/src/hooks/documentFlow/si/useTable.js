// hooks/si/useTable.js
import { useState, useEffect, useCallback } from 'react';
import { getSalesInvoices } from '../../services/siApi';

export const useTable = ({
    currentPage,
    setCurrentPage,
    search,
    startDate,
    endDate,
    pickUpStartDate,
    pickUpEndDate,
    sortBy,
    sortOrder
}) => {
    const [siList, setSiList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState(null);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const fetchData = useCallback(async () => {
        setFetching(true);
        setError(null);

        try {
            const params = {
                page: currentPage,
                limit: pageSize,
                search,
                startDate,
                endDate,
                pickUpStartDate,
                pickUpEndDate,
                sortBy,
                sortOrder
            };

            const res = await getSalesInvoices(params);

            if (res.success) {
                setSiList(res.data || []);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages || 1);
                    setTotalItems(res.pagination.totalItems || 0);
                }
            } else {
                setError(res.message || 'Failed to load sales invoices data');
            }
        } catch (err) {
            console.error('Error fetching sales invoices:', err);
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
        pickUpStartDate,
        pickUpEndDate,
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
        siList,
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
