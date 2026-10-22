import { useState, useEffect, useCallback } from 'react';
import { fetchDeliveryOrderMapping } from '../../../services/doApi';

export const useDeliveryOrderTable = (reloadTrigger, filterState, viewMode) => {
    const [mappingList, setMappingList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [sortKey, setSortKey] = useState('');
    const [sortOrder, setSortOrder] = useState('DESC');

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    const searchQuery = filterState?.searchQuery || '';
    const fromDoDate = filterState?.fromDoDate || '';
    const toDoDate = filterState?.toDoDate || '';

    const getDisplayMode = (mode) => {
        if (mode === 'PO' || mode === 'BY_PO') return 'BY_PO';
        if (mode === 'LOT' || mode === 'BY_LOT') return 'BY_LOT';
        return 'BY_DO';
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = {
                search: searchQuery,
                displayMode: getDisplayMode(viewMode),
                fromDoDate,
                toDoDate,
                sortKey,
                sortOrder
            };

            const res = await fetchDeliveryOrderMapping(page, limit, filters);
            if (res && res.success) {
                setMappingList(res.data || []);
                if (res.pagination) {
                    setPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            } else {
                setError(res?.message || 'Failed to fetch DO mapping data.');
            }
        } catch (err) {
            setError('An error occurred while loading DO mapping data.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, viewMode, sortKey, sortOrder, searchQuery, fromDoDate, toDoDate]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    useEffect(() => {
        setPage(1);
        setSortKey('');
        setSortOrder('DESC');
    }, [viewMode]);

    const handleSort = (key, order) => {
        setSortKey(key);
        setSortOrder(order);
        setPage(1);
    };

    return {
        mappingList,
        loading,
        error,
        sortKey,
        sortOrder,
        page,
        limit,
        pagination,
        setPage,
        setLimit,
        handleSort,
        refreshData: loadData
    };
};

export default useDeliveryOrderTable;
