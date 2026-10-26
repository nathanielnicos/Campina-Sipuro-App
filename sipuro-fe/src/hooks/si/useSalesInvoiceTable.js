import { useState, useEffect, useCallback } from 'react';
import { fetchSalesInvoiceMapping } from '../../services/siApi';

export const useSalesInvoiceTable = (reloadTrigger, filterState, viewMode) => {
    const [mappingList, setMappingList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    const searchQuery = filterState?.searchQuery || '';
    const fromSiDate = filterState?.fromSiDate || '';
    const toSiDate = filterState?.toSiDate || '';

    const getDisplayMode = (mode) => (mode === 'DO' || mode === 'BY_DO' ? 'BY_DO' : 'BY_SI');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = {
                search: searchQuery,
                displayMode: getDisplayMode(viewMode),
                fromSiDate,
                toSiDate
            };

            const res = await fetchSalesInvoiceMapping(page, limit, filters);
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
                setError(res?.message || 'Failed to fetch SI mapping data.');
            }
        } catch (err) {
            setError('An error occurred while loading SI data.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, viewMode, searchQuery, fromSiDate, toSiDate]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    useEffect(() => {
        setPage(1);
    }, [viewMode]);

    return {
        mappingList,
        loading,
        error,
        page,
        limit,
        pagination,
        setPage,
        setLimit,
        refreshData: loadData
    };
};
