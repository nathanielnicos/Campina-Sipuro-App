import { useState, useEffect, useCallback } from 'react';
import { getPrices } from '../../services/superadminApi';
import { previewPricesApi, commitPricesApi } from '../../services/masterUploadApi';
import { useGlobalModal } from '../../context/ModalContext';

export const usePriceList = () => {
    // Modal Global Context
    const { showAlert } = useGlobalModal();

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
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'Failed to fetch price data from database.'
            });
        } finally {
            setLoadingData(false);
        }
    }, [currentPage, pageSize, search, showAlert]);

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
        if (!selectedFile) {
            return showAlert({
                type: 'warning',
                title: 'File Required',
                message: 'Please select an Excel file first.'
            });
        }

        setUploading(true);
        try {
            const res = await previewPricesApi(selectedFile);
            if (res.success) {
                setPreviewModal({ open: true, title: 'Product Selling Price List', data: res });
            }
        } catch (err) {
            console.error('Error previewing prices:', err);
            showAlert({
                type: 'error',
                title: 'Preview Failed',
                message: err.response?.data?.message || 'Failed to process Excel price preview.'
            });
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
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Price list successfully saved to database.'
                });
                setPreviewModal({ open: false, title: '', data: null });
                setSelectedFile(null);
                fetchPricesData();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Save Failed',
                    message: res.message || 'Failed to save price data to database.'
                });
            }
        } catch (err) {
            console.error('Error committing prices:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: err.response?.data?.message || 'Failed to save data to database.'
            });
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
