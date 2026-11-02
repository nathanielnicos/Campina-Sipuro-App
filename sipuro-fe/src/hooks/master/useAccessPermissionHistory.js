import { useState, useEffect, useCallback, useRef } from 'react';
import { getAccessPermissionLogs } from '../../services/permissionApi';
import { useGlobalModal } from '../../context/ModalContext';

// Riwayat perubahan izin; dimuat ulang saat `reloadKey` berubah (setelah simpan).
export const useAccessPermissionHistory = (reloadKey) => {
    const { showAlert } = useGlobalModal();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Hanya jawaban permintaan terbaru yang boleh mengisi tabel.
    const requestIdRef = useRef(0);

    const fetchLogs = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        try {
            setLoading(true);
            const res = await getAccessPermissionLogs(currentPage, pageSize);
            if (requestId !== requestIdRef.current) return;
            if (res.success) {
                setLogs(res.data);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages);
                    setTotalItems(res.pagination.totalItems);
                }
            }
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error('Failed to fetch permission history:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: err.response?.data?.message || 'Failed to fetch permission history.'
            });
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [currentPage, pageSize, showAlert]);

    // reloadKey sengaja dibaca di sini agar simpan baru memicu muat ulang
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs, reloadKey]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
    };

    const handleLimitChange = (newLimit) => {
        setPageSize(newLimit);
        setCurrentPage(1);
    };

    return { logs, loading, currentPage, pageSize, totalPages, totalItems, handlePageChange, handleLimitChange };
};
