import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchDeliveryOrderMapping } from '../../../services/doApi';

const DISPLAY_MODE_BY_VIEW = { DO: 'BY_DO', LOT: 'BY_LOT', RETURN: 'BY_RETURN', READY: 'READY_TO_SHIP' };
const toDisplayMode = (viewMode) => DISPLAY_MODE_BY_VIEW[viewMode] || 'BY_DO';

export const useDeliveryOrderTable = (reloadTrigger, filterState, viewMode) => {
    // Data disimpan bersama mode asalnya, sehingga baris mode lama tidak pernah dirender oleh mode baru
    const [loaded, setLoaded] = useState({ mode: null, list: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    // Hanya respons permintaan terakhir yang dipakai
    const requestSeq = useRef(0);

    const searchQuery = filterState?.searchQuery || '';
    // Tiga rentang tanggal terpisah (DO, Return, Lot Completed); yang tidak berlaku di tampilan ini dikirim kosong oleh pemanggil
    const fromDoDate = filterState?.fromDoDate || '';
    const toDoDate = filterState?.toDoDate || '';
    const fromReturnDate = filterState?.fromReturnDate || '';
    const toReturnDate = filterState?.toReturnDate || '';
    const fromCompletedDate = filterState?.fromCompletedDate || '';
    const toCompletedDate = filterState?.toCompletedDate || '';
    const displayMode = toDisplayMode(viewMode);

    const loadData = useCallback(async () => {
        const seq = ++requestSeq.current;
        setLoading(true);
        setError('');
        try {
            const res = await fetchDeliveryOrderMapping(page, limit, {
                search: searchQuery,
                displayMode,
                fromDoDate,
                toDoDate,
                fromReturnDate,
                toReturnDate,
                fromCompletedDate,
                toCompletedDate
            });
            if (seq !== requestSeq.current) return;

            if (res && res.success) {
                setLoaded({ mode: displayMode, list: res.data || [] });
                if (res.pagination) {
                    setPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            } else {
                setError(res?.message || 'Failed to fetch DO data.');
            }
        } catch (err) {
            if (seq !== requestSeq.current) return;
            setError('An error occurred while loading DO data.');
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    }, [page, limit, displayMode, searchQuery, fromDoDate, toDoDate, fromReturnDate, toReturnDate, fromCompletedDate, toCompletedDate]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    useEffect(() => {
        setPage(1);
    }, [viewMode]);

    return {
        mappingList: loaded.mode === displayMode ? loaded.list : [],
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

export default useDeliveryOrderTable;
