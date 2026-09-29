import { useState, useEffect, useCallback } from 'react';
import { getProducts } from '../../services/superadminApi';
import { previewProductsApi, commitProductsApi } from '../../services/masterUploadApi';
import { useGlobalModal } from '../../context/ModalContext';

export const useProductList = () => {
    // Modal Global Context
    const { showAlert } = useGlobalModal();

    const [products, setProducts] = useState([]);
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

    const fetchProductsData = useCallback(async () => {
        try {
            setLoadingData(true);
            const res = await getProducts(currentPage, pageSize, search);
            if (res.success) {
                setProducts(res.data);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages);
                    setTotalItems(res.pagination.totalItems);
                }
            }
        } catch (err) {
            console.error('Gagal mengambil data produk:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'Failed to fetch product data from database.'
            });
        } finally {
            setLoadingData(false);
        }
    }, [currentPage, pageSize, search, showAlert]);

    useEffect(() => {
        fetchProductsData();
    }, [fetchProductsData]);

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleResetFilter = () => {
        setSearch('');
        setCurrentPage(1);
    };

    const handlePreviewProducts = async (e) => {
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
            const res = await previewProductsApi(selectedFile);
            if (res.success) {
                setPreviewModal({ open: true, title: 'Master SKU Product List', data: res });
            }
        } catch (err) {
            console.error('Error previewing products:', err);
            showAlert({
                type: 'error',
                title: 'Preview Failed',
                message: err.response?.data?.message || 'Failed to process Excel product preview.'
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

            const res = await commitProductsApi(items, createdBy);
            if (res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Product data successfully saved to database.'
                });
                setPreviewModal({ open: false, title: '', data: null });
                setSelectedFile(null);
                fetchProductsData();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Save Failed',
                    message: res.message || 'Failed to save product data to database.'
                });
            }
        } catch (err) {
            console.error('Error committing products:', err);
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
        products,
        loadingData,
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
        handlePreviewProducts,
        handleConfirmCommit,
        handlePageChange,
        handleLimitChange,
        closePreviewModal
    };
};
