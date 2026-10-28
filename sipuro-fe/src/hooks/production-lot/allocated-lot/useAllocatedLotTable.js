import { useState, useEffect, useCallback } from 'react';
import { fetchLotMapping } from '../../../services/productionLotApi';

export const useAllocatedLotTable = (currentUser, reloadTrigger, filterState, viewMode) => {
    const [mappingList, setMappingList] = useState([]);
    const [poTolerance, setPoTolerance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [sortKey, setSortKey] = useState('');
    const [sortOrder, setSortOrder] = useState('ASC');

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    const searchQuery = filterState?.searchQuery || '';
    const status = filterState?.status || '';
    const fromActualDate = filterState?.fromActualDate || '';
    const toActualDate = filterState?.toActualDate || '';
    const fromCreatedDate = filterState?.fromCreatedDate || '';
    const toCreatedDate = filterState?.toCreatedDate || '';

    // Petakan ke 3 displayMode backend
    const getDisplayMode = (mode) => {
        if (mode === 'BATCH' || mode === 'BY_BATCH') return 'BY_BATCH';
        if (mode === 'LOT' || mode === 'BY_LOT') return 'BY_LOT';
        return 'BY_PO';
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = {
                search: searchQuery,
                status,
                displayMode: getDisplayMode(viewMode),
                fromActualDate,
                toActualDate,
                fromCreatedDate,
                toCreatedDate,
                sortKey,
                sortOrder
            };

            const res = await fetchLotMapping(page, limit, filters);
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
                setError(res?.message || 'Failed to fetch lot mapping data.');
            }
        } catch (err) {
            setError('An error occurred while loading lot mapping data.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, viewMode, sortKey, sortOrder, searchQuery, status, fromActualDate, toActualDate, fromCreatedDate, toCreatedDate]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    useEffect(() => {
        setPage(1);
        setSortKey('');
        setSortOrder('ASC');
    }, [viewMode]);

    const handleSort = (key, order) => {
        setSortKey(key);
        setSortOrder(order);
        setPage(1);
    };

    return {
        mappingList,
        poTolerance,
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

export default useAllocatedLotTable;
