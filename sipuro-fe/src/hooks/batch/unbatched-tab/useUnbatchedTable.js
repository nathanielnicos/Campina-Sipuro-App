import { useState, useEffect, useCallback } from 'react';
import { fetchUnassignedSummary } from '../../../services/batchApi';

export const useUnbatchedTable = (reloadTrigger) => {
    const [summaryList, setSummaryList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [searchProduct, setSearchProduct] = useState('');
    const [searchPo, setSearchPo] = useState('');

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = { searchProduct, searchPo };
            const res = await fetchUnassignedSummary(page, limit, filters);
            if (res && res.success) {
                setSummaryList(res.data || []);
                if (res.pagination) {
                    setPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            } else {
                setError(res?.message || 'Failed to fetch batch summary data.');
            }
        } catch (err) {
            setError('An error occurred while loading data.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, searchProduct, searchPo]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    const handleProductChange = (e) => {
        setSearchProduct(e.target.value);
        setPage(1);
    };

    const handlePoChange = (e) => {
        setSearchPo(e.target.value);
        setPage(1);
    };

    const handleResetFilters = () => {
        setSearchProduct('');
        setSearchPo('');
        setPage(1);
    };

    return {
        summaryList,
        loading,
        error,
        searchProduct,
        searchPo,
        page,
        limit,
        pagination,
        setPage,
        setLimit,
        loadData,
        handleProductChange,
        handlePoChange,
        handleResetFilters
    };
};
