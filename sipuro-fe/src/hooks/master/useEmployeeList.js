import { useState, useEffect, useCallback } from 'react';
import { getEmployees, toggleEmployeeStatus } from '../../services/superadminApi';

export const useEmployeeList = () => {
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
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, search]);

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

    const handleToggleStatus = async (emp) => {
        const nextStatus = emp.is_suspended ? 0 : 1;
        const confirmMsg = emp.is_suspended
            ? `Activate employee account "${emp.full_name}"?`
            : `Deactivate / Suspend employee account "${emp.full_name}"?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            setUpdatingId(emp.id);
            const res = await toggleEmployeeStatus(emp.id, nextStatus === 1);
            if (res.success) {
                fetchEmployeesData();
            } else {
                alert(res.message || 'Failed to update employee status.');
            }
        } catch (err) {
            console.error('Error toggling status:', err);
            alert('An error occurred while updating status.');
        } finally {
            setUpdatingId(null);
        }
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
