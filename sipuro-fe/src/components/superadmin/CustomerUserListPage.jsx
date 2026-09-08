import { useState, useEffect, useCallback } from 'react';
import { getCustomerUsers, toggleCustomerUserStatus } from '../../services/superadminApi';
import PaginationControl from '../common/PaginationControl';

const CustomerUserListPage = () => {
    const [customerUsers, setCustomerUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    // State Filter & Search
    const [search, setSearch] = useState('');

    // State Pagination
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
            ? `Aktifkan user "${user.full_name}" (${user.customer_user_code})?`
            : `Nonaktifkan user "${user.full_name}" (${user.customer_user_code})?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            setUpdatingId(user.customer_user_id);
            const res = await toggleCustomerUserStatus(user.customer_user_id, nextStatus);
            if (res.success) {
                fetchCustomerUsersData();
            } else {
                alert(res.message || 'Gagal mengubah status customer user.');
            }
        } catch (err) {
            console.error('Error toggling customer user status:', err);
            alert('Terjadi kesalahan saat mengubah status customer user.');
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
                <div style={{ flex: '1 1 250px', maxWidth: '350px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                        Cari User / Perusahaan
                    </label>
                    <input
                        type="text"
                        placeholder="Cari Username, Nama, Email, atau Perusahaan..."
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
                <div>Memuat data customer user...</div>
            ) : (
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '10px' }}>Username</th>
                                    <th style={{ padding: '10px' }}>Nama Lengkap</th>
                                    <th style={{ padding: '10px' }}>Email</th>
                                    <th style={{ padding: '10px' }}>Perusahaan</th>
                                    <th style={{ padding: '10px' }}>Status</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customerUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '15px', textAlign: 'center' }}>Tidak ada data user customer</td>
                                    </tr>
                                ) : (
                                    customerUsers.map((u) => {
                                        const isActive = u.is_active === 1 || u.is_active === true;
                                        return (
                                            <tr key={u.customer_user_id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                                <td style={{ padding: '10px', fontWeight: 'bold' }}>{u.customer_user_code}</td>
                                                <td style={{ padding: '10px' }}>{u.full_name}</td>
                                                <td style={{ padding: '10px' }}>{u.email || '-'}</td>
                                                <td style={{ padding: '10px' }}>
                                                    {u.company_name} <span style={{ color: '#6c757d', fontSize: '11px' }}>({u.customer_code})</span>
                                                </td>
                                                <td style={{ padding: '10px', color: isActive ? '#198754' : '#ef4444', fontWeight: 'bold' }}>
                                                    {isActive ? 'Aktif' : 'Nonaktif'}
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => handleToggleStatus(u)}
                                                        disabled={updatingId === u.customer_user_id}
                                                        style={{
                                                            padding: '5px 10px',
                                                            fontSize: '12px',
                                                            fontWeight: 'bold',
                                                            borderRadius: '4px',
                                                            border: 'none',
                                                            cursor: updatingId === u.customer_user_id ? 'not-allowed' : 'pointer',
                                                            backgroundColor: isActive ? '#dc3545' : '#198754',
                                                            color: '#fff'
                                                        }}
                                                    >
                                                        {updatingId === u.customer_user_id
                                                            ? 'Proses...'
                                                            : isActive
                                                                ? 'Nonaktifkan'
                                                                : 'Aktifkan'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
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

export default CustomerUserListPage;
