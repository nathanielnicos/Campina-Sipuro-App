import React, { useState, useEffect, useCallback } from 'react';
import { getEmployees, toggleEmployeeStatus } from '../../services/superadminApi';
import PaginationControl from '../common/PaginationControl';

const EmployeeListPage = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    // State Filter & Search
    const [search, setSearch] = useState('');

    // State Pagination
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
            ? `Aktifkan akun karyawan "${emp.full_name}"?`
            : `Nonaktifkan / Suspend akun karyawan "${emp.full_name}"?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            setUpdatingId(emp.id);
            const res = await toggleEmployeeStatus(emp.id, nextStatus === 1);
            if (res.success) {
                fetchEmployeesData();
            } else {
                alert(res.message || 'Gagal mengubah status karyawan.');
            }
        } catch (err) {
            console.error('Error toggling status:', err);
            alert('Terjadi kesalahan saat mengubah status.');
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            {/* Filter / Search Bar */}
            <div style={{
                backgroundColor: '#fff',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                marginBottom: '20px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-end'
            }}>
                <div style={{ flex: '1 1 250px', maxWidth: '300px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                        Cari Kode / Nama Karyawan
                    </label>
                    <input
                        type="text"
                        placeholder="Cari Kode Karyawan atau Nama..."
                        value={search}
                        onChange={handleSearchChange}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '13px' }}
                    />
                </div>
                {search && (
                    <button
                        onClick={handleResetFilter}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: '#dc3545',
                            color: '#fff',
                            border: '1px solid #dc3545',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px'
                        }}
                    >
                        Reset Filter
                    </button>
                )}
            </div>

            {loading ? (
                <div>Memuat data karyawan...</div>
            ) : (
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '10px' }}>Kode Karyawan</th>
                                    <th style={{ padding: '10px' }}>Nama Lengkap</th>
                                    <th style={{ padding: '10px' }}>Gender</th>
                                    <th style={{ padding: '10px' }}>Departemen</th>
                                    <th style={{ padding: '10px' }}>Tanggal Lahir</th>
                                    <th style={{ padding: '10px' }}>Status</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.length === 0 ? (
                                    <tr><td colSpan="7" style={{ padding: '15px', textAlign: 'center' }}>Tidak ada data karyawan</td></tr>
                                ) : (
                                    employees.map((emp) => (
                                        <tr key={emp.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={{ padding: '10px', fontWeight: 'bold' }}>{emp.employee_code}</td>
                                            <td style={{ padding: '10px' }}>{emp.full_name}</td>
                                            <td style={{ padding: '10px' }}>{emp.gender || '-'}</td>
                                            <td style={{ padding: '10px' }}>{emp.department || '-'}</td>
                                            <td style={{ padding: '10px' }}>
                                                {emp.birth_date ? new Date(emp.birth_date).toLocaleDateString('id-ID') : '-'}
                                            </td>
                                            <td style={{ padding: '10px', color: emp.is_suspended ? '#ef4444' : '#198754', fontWeight: 'bold' }}>
                                                {emp.is_suspended ? 'Nonaktif' : 'Aktif'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleToggleStatus(emp)}
                                                    disabled={updatingId === emp.id}
                                                    style={{
                                                        padding: '5px 10px',
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        cursor: updatingId === emp.id ? 'not-allowed' : 'pointer',
                                                        backgroundColor: emp.is_suspended ? '#198754' : '#dc3545',
                                                        color: '#fff'
                                                    }}
                                                >
                                                    {updatingId === emp.id
                                                        ? 'Proses...'
                                                        : emp.is_suspended
                                                            ? 'Aktifkan'
                                                            : 'Nonaktifkan'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <PaginationControl
                        pagination={{
                            currentPage,
                            totalPages,
                            totalItems,
                            limit: pageSize
                        }}
                        onPageChange={handlePageChange}
                        onLimitChange={handleLimitChange}
                    />
                </div>
            )}
        </div>
    );
};

export default EmployeeListPage;
