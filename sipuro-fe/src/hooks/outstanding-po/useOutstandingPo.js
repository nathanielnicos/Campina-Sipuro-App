import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchOutstandingPo } from '../../services/outstandingPoApi';
import { buildListParams, parseLegacyQuery, EMPTY_FILTERS, PAGE_LIMIT } from '../../utils/outstandingPoHelpers';

const DEBOUNCE_MS = 300;
const EMPTY_PAGINATION = { totalItems: 0, totalPages: 1, currentPage: 1, limit: PAGE_LIMIT };

export const useOutstandingPo = () => {
    const [searchParams] = useSearchParams();
    const urlQuery = searchParams.toString();

    const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, ...parseLegacyQuery(urlQuery) }));
    const [appliedFilters, setAppliedFilters] = useState(filters);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(PAGE_LIMIT);
    const [sortKey, setSortKey] = useState('');
    const [sortOrder, setSortOrder] = useState('ASC');
    const [reloadTick, setReloadTick] = useState(0);

    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState(EMPTY_PAGINATION);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Tautan notifikasi pada halaman yang sudah terbuka: terapkan filternya.
    const firstUrlRun = useRef(true);
    useEffect(() => {
        if (firstUrlRun.current) {
            firstUrlRun.current = false;
            return;
        }
        const next = { ...EMPTY_FILTERS, ...parseLegacyQuery(urlQuery) };
        setFilters(next);
        setAppliedFilters(next);
        setPage(1);
    }, [urlQuery]);

    // Pengetikan ditahan sebentar agar tidak memanggil server di setiap huruf.
    useEffect(() => {
        const timer = setTimeout(() => {
            setAppliedFilters(filters);
            setPage(1);
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [filters]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);

        fetchOutstandingPo(
            buildListParams({ page, limit, sortKey, sortOrder, filters: appliedFilters }),
            controller.signal
        ).then((result) => {
            if (result.canceled) return;
            if (result.success) {
                setRows(result.data || []);
                setPagination({
                    totalItems: Number(result.pagination?.totalItems) || 0,
                    totalPages: Number(result.pagination?.totalPages) || 1,
                    currentPage: Number(result.pagination?.currentPage) || 1,
                    limit: Number(result.pagination?.limit) || limit
                });
            } else {
                setRows([]);
                setError(result.message || 'Failed to fetch outstanding PO data.');
            }
            setLoading(false);
        });

        return () => controller.abort();
    }, [appliedFilters, page, limit, sortKey, sortOrder, reloadTick]);

    const updateFilter = useCallback((name, value) => {
        setFilters((current) => ({ ...current, [name]: value }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(EMPTY_FILTERS);
        setSortKey('');
        setSortOrder('ASC');
    }, []);

    const handleSort = useCallback((key, order) => {
        setSortKey(key);
        setSortOrder(order);
        setPage(1);
    }, []);

    const changeLimit = useCallback((value) => {
        setLimit(value);
        setPage(1);
    }, []);

    const reload = useCallback(() => setReloadTick((tick) => tick + 1), []);

    return {
        filters, updateFilter, resetFilters,
        setPage, changeLimit, sortKey, sortOrder, handleSort,
        rows, pagination, loading, error, setError, reload
    };
};
