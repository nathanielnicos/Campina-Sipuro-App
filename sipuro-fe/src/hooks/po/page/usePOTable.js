import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPOListApi } from '../../../services/poApi';

export const usePOTable = ({
    customerId,
    currentPage,
    setCurrentPage,
    search,
    startDate,
    endDate,
    status,
    sortBy,
    sortOrder,
    refreshSignal = 0
}) => {
    const [poList, setPoList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const isInitialLoaded = useRef(false);
    const abortRef = useRef(null);

    const getPOList = useCallback(async () => {
        // Batalkan permintaan sebelumnya yang masih berjalan (mis. saat mengetik cepat / ganti halaman)
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

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
            const result = await fetchPOListApi(customerId, currentPage, pageSize, filters, controller.signal);

            // Respons dari permintaan yang sudah dibatalkan tidak boleh menimpa data terbaru
            if (controller.signal.aborted) return;

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
            if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return;
            console.error('Error fetching PO:', err);
            setError('A network error occurred or the server is down.');
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
                setFetching(false);
            }
        }
    }, [customerId, currentPage, pageSize, search, startDate, endDate, status, sortBy, sortOrder]);

    // refreshSignal sengaja menjadi dependensi efek ini (bukan getPOList): saat nilainya berubah,
    // daftar dimuat ulang tanpa memasang ulang halaman, sehingga filter dan halaman aktif tetap.
    useEffect(() => {
        getPOList();
    }, [getPOList, refreshSignal]);

    // Batalkan permintaan yang tertunda saat halaman ditutup
    useEffect(() => () => {
        if (abortRef.current) abortRef.current.abort();
    }, []);

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
