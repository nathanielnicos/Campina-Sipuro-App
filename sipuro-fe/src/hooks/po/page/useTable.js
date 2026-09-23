import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPOListApi } from '../../../services/poApi';

export const useTable = ({
    customerId,
    currentPage,
    setCurrentPage,
    search,
    startDate,
    endDate,
    status,
    sortBy,
    sortOrder
}) => {
    const [poList, setPoList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const isInitialLoaded = useRef(false);

    const getPOList = useCallback(async () => {
        try {
            if (isInitialLoaded.current) {
                setFetching(true);
            } else {
                setLoading(true);
            }

            setError('');

            const filters = { 
                search, 
                startDate, 
                endDate,
                status, 
                sortBy, 
                sortOrder 
            };
            const result = await fetchPOListApi(customerId, currentPage, pageSize, filters);

            if (result.success) {
                setPoList(result.data);
                isInitialLoaded.current = true;
                if (result.pagination) {
                    setTotalPages(result.pagination.totalPages);
                    setTotalItems(result.pagination.totalItems);
                }
            } else {
                setError(result.message || 'Failed to fetch PO data.');
            }
        } catch (err) {
            console.error('Error fetching PO:', err);
            setError('A network error occurred or the server is down.');
        } finally {
            setLoading(false);
            setFetching(false);
        }
    }, [customerId, currentPage, pageSize, search, startDate, endDate, status, sortBy, sortOrder]);

    useEffect(() => {
        getPOList();
    }, [getPOList]);

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
        poList,
        loading,
        fetching,
        error,
        pageSize,
        totalPages,
        totalItems,
        handlePageChange,
        handleLimitChange
    };
};
