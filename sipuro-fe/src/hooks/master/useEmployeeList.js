import { useState, useEffect, useCallback } from 'react';
import { getEmployees, toggleEmployeeStatus } from '../../services/superadminApi';
import { useGlobalModal } from '../../context/ModalContext';

export const useEmployeeList = () => {
    // Modal Global Context
    const { showConfirm, showAlert } = useGlobalModal();

    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    // Filter & Search
    const [search, setSearch] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const fetchEmployeesData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getEmployees(currentPage, pageSize, search);
            if (res.success) {
                setEmployees(res.data);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages);
                    setTotalItems(res.pagination.totalItems);
                }
            }
        } catch (err) {
            console.error('Gagal mengambil data karyawan:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'Failed to fetch employee data.'
            });
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, search, showAlert]);

    useEffect(() => {
        fetchEmployeesData();
    }, [fetchEmployeesData]);

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

    // Internal execution function for toggling employee status
    const executeToggleStatus = async (emp, isActivating) => {
        try {
            setUpdatingId(emp.id);
            // Nilai is_suspended diset ke false jika isActivating true, dan set ke true jika isActivating false
            const targetSuspendedState = !isActivating;

            const res = await toggleEmployeeStatus(emp.id, targetSuspendedState);
            if (res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || `Employee account successfully ${isActivating ? 'activated' : 'deactivated/suspended'}.`
                });
                fetchEmployeesData();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Update Failed',
                    message: res.message || 'Failed to update employee status.'
                });
            }
        } catch (err) {
            console.error('Error toggling status:', err);
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'An error occurred while updating employee status.'
            });
        } finally {
            setUpdatingId(null);
        }
    };

    const handleToggleStatus = (emp) => {
        const isActivating = Boolean(emp.is_suspended);
        const actionTitle = isActivating ? 'Activate Employee' : 'Deactivate / Suspend Employee';
        const actionText = isActivating ? 'activate' : 'deactivate / suspend';

        showConfirm({
            title: actionTitle,
            message: `Are you sure you want to ${actionText} employee account "${emp.full_name}"?`,
            confirmText: isActivating ? 'Activate' : 'Deactivate',
            onConfirm: () => executeToggleStatus(emp, isActivating)
        });
    };

    return {
        employees,
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
