import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchOutstandingSummary } from '../../../services/batchApi';
import {
    requestClosePoDetailsApi,
    approveClosePoDetailsApi,
    rejectClosePoDetailsApi
} from '../../../services/poApi';

export const useOutstandingTable = (reloadTrigger, currentUser) => {
    const [summaryList, setSummaryList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // State Filter & Sorting
    const [searchParams] = useSearchParams();

    const initialProduct = searchParams.get('product') || '';
    const initialPo = searchParams.get('po') || searchParams.get('search') || '';

    const [searchProduct, setSearchProduct] = useState(initialProduct);
    const [searchPo, setSearchPo] = useState(initialPo);
    const [fromCreatedDate, setFromCreatedDate] = useState('');
    const [toCreatedDate, setToCreatedDate] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const [sortKey, setSortKey] = useState('');
    const [sortOrder, setSortOrder] = useState('ASC');

    // Pagination State
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    // State Modal Konfirmasi & Input Aksi
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        type: null, // 'REQUEST_CLOSE' | 'APPROVE_CLOSE' | 'REJECT_CLOSE'
        poHeaderId: null,
        poDetailId: null,
        poNumber: '',
        productName: ''
    });
    const [actionReason, setActionReason] = useState(''); // Hanya dipakai saat REQUEST_CLOSE
    const [reasonError, setReasonError] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = {
                searchProduct,
                searchPo,
                fromCreatedDate,
                toCreatedDate,
                status: statusFilter,
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
        statusFilter,
        sortKey,
        sortOrder
    ]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    // Sinkronisasi jika query URL berubah saat halaman Outstanding sedang aktif
    useEffect(() => {
        const urlProduct = searchParams.get('product') || '';
        const urlPo = searchParams.get('po') || searchParams.get('search') || '';

        setSearchProduct(prev => (prev !== urlProduct ? urlProduct : prev));
        setSearchPo(prev => (prev !== urlPo ? urlPo : prev));
    }, [searchParams]);

    // Handlers Filter Input
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

    const handleStatusFilterChange = (e) => {
        setStatusFilter(e.target.value);
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
        setStatusFilter('');
        setSortKey('');
        setSortOrder('ASC');
        setPage(1);
    };

    /**
     * HANDLERS MODAL KONFIRMASI
     */
    const openConfirmModal = (type, poHeaderId, poDetailId, poNumber = '', productName = '') => {
        setActionReason('');
        setReasonError('');
        setConfirmModal({
            isOpen: true,
            type,
            poHeaderId,
            poDetailId,
            poNumber,
            productName
        });
    };

    const closeConfirmModal = () => {
        setConfirmModal({
            isOpen: false,
            type: null,
            poHeaderId: null,
            poDetailId: null,
            poNumber: '',
            productName: ''
        });
        setActionReason('');
        setReasonError('');
    };

    /**
     * EKSEKUSI AKSI SETELAH KONFIRMASI DITERIMA DARI USER
     */
    const handleConfirmSubmit = async () => {
        const { type, poHeaderId, poDetailId } = confirmModal;

        // Validasi alasan HANYA untuk pengajuan Request Close
        if (type === 'REQUEST_CLOSE' && !actionReason.trim()) {
            setReasonError('Please provide a reason before submitting.');
            return;
        }

        setActionLoading(true);
        setError('');
        setSuccessMessage('');

        try {
            let res;
            if (type === 'REQUEST_CLOSE') {
                const requestedBy = currentUser?.id || currentUser?.customer_id;
                res = await requestClosePoDetailsApi(poHeaderId, [poDetailId], actionReason, requestedBy);
            } else if (type === 'APPROVE_CLOSE') {
                const approvedBy = currentUser?.id || currentUser?.employee_id;
                res = await approveClosePoDetailsApi(poHeaderId, [poDetailId], approvedBy);
            } else if (type === 'REJECT_CLOSE') {
                const rejectedBy = currentUser?.id || currentUser?.employee_id;
                res = await rejectClosePoDetailsApi(poHeaderId, [poDetailId], rejectedBy);
            }

            if (res && res.success) {
                setSuccessMessage(res.message || 'Action processed successfully.');
                closeConfirmModal();
                loadData();
            } else {
                setError(res?.message || 'Failed to process request.');
            }
        } catch (err) {
            setError('An error occurred while processing the request.');
        } finally {
            setActionLoading(false);
        }
    };

    return {
        summaryList,
        loading,
        actionLoading,
        error,
        setError,
        successMessage,
        setSuccessMessage,
        searchProduct,
        searchPo,
        fromCreatedDate,
        toCreatedDate,
        statusFilter,
        sortKey,
        sortOrder,
        page,
        limit,
        pagination,
        confirmModal,
        actionReason,
        reasonError,
        setActionReason,
        setPage,
        setLimit,
        loadData,
        handleProductChange,
        handlePoChange,
        handleFromCreatedDateChange,
        handleToCreatedDateChange,
        handleStatusFilterChange,
        handleResetFilters,
        handleSort,
        openConfirmModal,
        closeConfirmModal,
        handleConfirmSubmit
    };
};
