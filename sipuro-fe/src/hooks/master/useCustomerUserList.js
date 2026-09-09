import { useState, useEffect, useCallback } from 'react';
import { getCustomerUsers, toggleCustomerUserStatus } from '../../services/superadminApi';

export const useCustomerUserList = () => {
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
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, search]);

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

    const handleToggleStatus = async (user) => {
        const isCurrentlyActive = user.is_active === 1 || user.is_active === true;
        const nextStatus = !isCurrentlyActive;
        const confirmMsg = nextStatus
            ? `Activate user "${user.full_name}" (${user.customer_user_code})?`
            : `Deactivate user "${user.full_name}" (${user.customer_user_code})?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            setUpdatingId(user.customer_user_id);
            const res = await toggleCustomerUserStatus(user.customer_user_id, nextStatus);
            if (res.success) {
                fetchCustomerUsersData();
            } else {
                alert(res.message || 'Failed to update customer user status.');
            }
        } catch (err) {
            console.error('Error toggling customer user status:', err);
            alert('An error occurred while updating customer user status.');
        } finally {
            setUpdatingId(null);
        }
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
