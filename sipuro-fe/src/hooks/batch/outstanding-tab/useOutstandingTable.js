import { useState, useEffect, useCallback } from 'react';
import { fetchOutstandingSummary } from '../../../services/batchApi';

export const useOutstandingTable = (reloadTrigger) => {
    const [summaryList, setSummaryList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [searchProduct, setSearchProduct] = useState('');
    const [searchPo, setSearchPo] = useState('');
    const [fromCreatedDate, setFromCreatedDate] = useState('');
    const [toCreatedDate, setToCreatedDate] = useState('');
    const [fromDeliveryDate, setFromDeliveryDate] = useState('');
    const [toDeliveryDate, setToDeliveryDate] = useState('');

    const [sortKey, setSortKey] = useState('');
    const [sortOrder, setSortOrder] = useState('ASC');

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
                toCreatedDate,
                fromDeliveryDate,
                toDeliveryDate,
                sortKey,
                sortOrder
            };
            const res = await fetchOutstandingSummary(page, limit, filters);
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
    }, [
        page,
        limit,
        searchProduct,
        searchPo,
        fromCreatedDate,
        toCreatedDate,
        fromDeliveryDate,
        toDeliveryDate,
        sortKey,
        sortOrder
    ]);

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

    const handleFromCreatedDateChange = (e) => {
        setFromCreatedDate(e.target.value);
        setPage(1);
    };

    const handleToCreatedDateChange = (e) => {
        setToCreatedDate(e.target.value);
        setPage(1);
    };

    const handleFromDeliveryDateChange = (e) => {
        setFromDeliveryDate(e.target.value);
        setPage(1);
    };

    const handleToDeliveryDateChange = (e) => {
        setToDeliveryDate(e.target.value);
        setPage(1);
    };

    const handleSort = (key, order) => {
        setSortKey(key);
        setSortOrder(order);
        setPage(1);
    };

    const handleResetFilters = () => {
        setSearchProduct('');
        setSearchPo('');
        setFromCreatedDate('');
        setToCreatedDate('');
        setFromDeliveryDate('');
        setToDeliveryDate('');
        setSortKey('');
        setSortOrder('ASC');
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
        fromDeliveryDate,
        toDeliveryDate,
        sortKey,
        sortOrder,
        page,
        limit,
        pagination,
        setPage,
        setLimit,
        loadData,
        handleProductChange,
        handlePoChange,
        handleFromCreatedDateChange,
        handleToCreatedDateChange,
        handleFromDeliveryDateChange,
        handleToDeliveryDateChange,
        handleResetFilters,
        handleSort
    };
};
