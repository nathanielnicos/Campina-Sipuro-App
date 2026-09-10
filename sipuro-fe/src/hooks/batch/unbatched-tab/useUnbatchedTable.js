import { useState, useEffect, useCallback } from 'react';
import { fetchUnassignedSummary } from '../../../services/batchApi';

export const useUnbatchedTable = (reloadTrigger) => {
    const [summaryList, setSummaryList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [searchProduct, setSearchProduct] = useState('');
    const [searchPo, setSearchPo] = useState('');
    const [fromCreatedDate, setFromCreatedDate] = useState('');
    const [toCreatedDate, setToCreatedDate] = useState('');

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = {
                searchProduct,
                searchPo,
                fromCreatedDate,
                toCreatedDate
            };
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
    }, [page, limit, searchProduct, searchPo, fromCreatedDate, toCreatedDate]);

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

    const handleFromDateChange = (e) => {
        setFromCreatedDate(e.target.value);
        setPage(1);
    };

    const handleToDateChange = (e) => {
        setToCreatedDate(e.target.value);
        setPage(1);
    };

    const handleResetFilters = () => {
        setSearchProduct('');
        setSearchPo('');
        setFromCreatedDate('');
        setToCreatedDate('');
        setPage(1);
    };

    return {
        summaryList,
        loading,
        error,
        searchProduct,
        searchPo,
        fromCreatedDate,
        toCreatedDate,
        page,
        limit,
        pagination,
        setPage,
        setLimit,
        loadData,
        handleProductChange,
        handlePoChange,
        handleFromDateChange,
        handleToDateChange,
        handleResetFilters
    };
};
