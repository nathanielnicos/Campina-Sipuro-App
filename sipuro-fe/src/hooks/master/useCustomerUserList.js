import { useState, useEffect, useCallback } from 'react';
import { getCustomerUsers, toggleCustomerUserStatus } from '../../services/superadminApi';
import { useGlobalModal } from '../../context/ModalContext';

export const useCustomerUserList = () => {
    // Modal Global Context
    const { showConfirm, showAlert } = useGlobalModal();

    const [customerUsers, setCustomerUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    // Filter & Search
    const [search, setSearch] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const fetchCustomerUsersData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getCustomerUsers(currentPage, pageSize, search);
            if (res.success) {
                setCustomerUsers(res.data);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages);
                    setTotalItems(res.pagination.totalItems);
                }
            }
        } catch (err) {
            console.error('Gagal mengambil data customer user:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'Failed to fetch customer users data.'
            });
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, search, showAlert]);

    useEffect(() => {
        fetchCustomerUsersData();
    }, [fetchCustomerUsersData]);

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleResetFilter = () => {
        setSearch('');
        setCurrentPage(1);
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

    // Internal execution function for toggling customer user status
    const executeToggleStatus = async (user, nextStatus) => {
        try {
            setUpdatingId(user.customer_user_id);
            const res = await toggleCustomerUserStatus(user.customer_user_id, nextStatus);
            if (res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || `Customer user status successfully ${nextStatus ? 'activated' : 'deactivated'}.`
                });
                fetchCustomerUsersData();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Update Failed',
                    message: res.message || 'Failed to update customer user status.'
                });
            }
        } catch (err) {
            console.error('Error toggling customer user status:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'An error occurred while updating customer user status.'
            });
        } finally {
            setUpdatingId(null);
        }
    };

    const handleToggleStatus = (user) => {
        const isCurrentlyActive = user.is_active === 1 || user.is_active === true;
        const nextStatus = !isCurrentlyActive;
        const actionText = nextStatus ? 'Activate' : 'Deactivate';

        showConfirm({
            title: `${actionText} Customer User`,
            message: `Are you sure you want to ${actionText.toLowerCase()} user "${user.full_name}" (${user.customer_user_code})?`,
            confirmText: actionText,
            onConfirm: () => executeToggleStatus(user, nextStatus)
        });
    };

    return {
        customerUsers,
        loading,
        updatingId,
        search,
        currentPage,
        pageSize,
        totalPages,
        totalItems,
        handleSearchChange,
        handleResetFilter,
        handlePageChange,
        handleLimitChange,
        handleToggleStatus
    };
};
