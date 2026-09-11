import { useState, useEffect, useCallback } from 'react';
import { getPrices } from '../../services/superadminApi';
import { previewPricesApi, commitPricesApi } from '../../services/masterUploadApi';

export const usePriceList = () => {
    const [prices, setPrices] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [previewModal, setPreviewModal] = useState({ open: false, title: '', data: null });

    // Filter & Search
    const [search, setSearch] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const fetchPricesData = useCallback(async () => {
        try {
            setLoadingData(true);
            const res = await getPrices(currentPage, pageSize, search);
            if (res.success) {
                setPrices(res.data);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages);
                    setTotalItems(res.pagination.totalItems);
                }
            }
        } catch (err) {
            console.error('Gagal mengambil data harga:', err);
        } finally {
            setLoadingData(false);
        }
    }, [currentPage, pageSize, search]);

    useEffect(() => {
        fetchPricesData();
    }, [fetchPricesData]);

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleResetFilter = () => {
        setSearch('');
        setCurrentPage(1);
    };

    const handlePreviewPrices = async (e) => {
        e.preventDefault();
        if (!selectedFile) return alert('Please select an Excel file first.');
        setUploading(true);
        try {
            const res = await previewPricesApi(selectedFile);
            if (res.success) {
                setPreviewModal({ open: true, title: 'Product Selling Price List', data: res });
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to process Excel price preview.');
        } finally {
            setUploading(false);
        }
    };

    const handleConfirmCommit = async (items) => {
        try {
            const savedUser = localStorage.getItem('sipuro_user');
            const currentUser = savedUser ? JSON.parse(savedUser) : null;
            const createdBy = currentUser?.code || currentUser?.name || 'SYSTEM';

            const res = await commitPricesApi(items, createdBy);
            if (res.success) {
                alert(res.message);
                setPreviewModal({ open: false, title: '', data: null });
                setSelectedFile(null);
                fetchPricesData();
            }
        } catch (err) {
            alert('Failed to save data to database.');
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleLimitChange = (newLimit) => {
        setPageSize(newLimit);
        setCurrentPage(1);
    };

    const closePreviewModal = () => {
        setPreviewModal({ open: false, title: '', data: null });
    };

    return {
        prices,
        loadingData,
        selectedFile,
        setSelectedFile,
        uploading,
        previewModal,
        search,
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        handleSearchChange,
        handleResetFilter,
        handlePreviewPrices,
        handleConfirmCommit,
        handlePageChange,
        handleLimitChange,
        closePreviewModal
    };
};
