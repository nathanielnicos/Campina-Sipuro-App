import { useState, useEffect, useCallback, useRef } from 'react';
import { getDeliveryOrders } from '../../../services/documentFlowApi';

const SEARCH_DEBOUNCE_MS = 400;

export const useDOTable = ({
    currentPage,
    setCurrentPage,
    search,
    startDate,
    endDate,
    pickUpStartDate,
    pickUpEndDate,
    sortBy,
    sortOrder,
    reloadTrigger
}) => {
    const [doList, setDoList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState(null);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Wait until the user stops typing before calling the API
    const [debouncedSearch, setDebouncedSearch] = useState(search);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);

    // Only the latest request may update the screen
    const requestIdRef = useRef(0);

    const fetchData = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setFetching(true);
        setError(null);

        try {
            const params = {
                page: currentPage,
                limit: pageSize,
                search: debouncedSearch,
                startDate,
                endDate,
                pickUpStartDate,
                pickUpEndDate,
                sortBy,
                sortOrder
            };

            const res = await getDeliveryOrders(params);
            if (requestId !== requestIdRef.current) return;

            if (res.success) {
                setDoList(res.data || []);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages || 1);
                    setTotalItems(res.pagination.totalItems || 0);
                }
            } else {
                setError(res.message || 'Failed to load delivery orders data');
            }
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error('Error fetching delivery orders:', err);
            setError(err.message || 'Server connection error');
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
                setFetching(false);
            }
        }
    }, [
        currentPage,
        pageSize,
        debouncedSearch,
        startDate,
        endDate,
        pickUpStartDate,
        pickUpEndDate,
        sortBy,
        sortOrder
    ]);

    // reloadTrigger is bumped by the parent after a successful upload to force a refetch
    useEffect(() => {
        fetchData();
    }, [fetchData, reloadTrigger]);

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
