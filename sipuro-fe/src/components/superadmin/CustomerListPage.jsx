import { useState, useEffect, useCallback } from 'react';
import { getCustomers, toggleCustomerStatus } from '../../services/superadminApi';
import PaginationControl from '../common/PaginationControl';

const CustomerListPage = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);

    // State Filter & Search
    const [search, setSearch] = useState('');

    // State Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const fetchCustomersData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getCustomers(currentPage, pageSize, search);
            if (res.success) {
                setCustomers(res.data);
                if (res.pagination) {
                    setTotalPages(res.pagination.totalPages);
                    setTotalItems(res.pagination.totalItems);
                }
            }
        } catch (err) {
            console.error('Gagal mengambil data customer:', err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, search]);

    useEffect(() => {
        fetchCustomersData();
    }, [fetchCustomersData]);

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

    const handleToggleStatus = async (customer) => {
        const isCurrentlyActive = customer.is_active === 1 || customer.is_active === true;
        const nextStatus = !isCurrentlyActive;
        const confirmMsg = nextStatus
            ? `Aktifkan akun pelanggan "${customer.company_name}"?`
            : `Nonaktifkan akun pelanggan "${customer.company_name}"?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            setUpdatingId(customer.customer_id);
            const res = await toggleCustomerStatus(customer.customer_id, nextStatus);
            if (res.success) {
                fetchCustomersData();
            } else {
                alert(res.message || 'Gagal mengubah status pelanggan.');
            }
        } catch (err) {
            console.error('Error toggling customer status:', err);
            alert('Terjadi kesalahan saat mengubah status pelanggan.');
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
                        Cari Kode / Nama Perusahaan
                    </label>
                    <input
                        type="text"
                        placeholder="Cari Kode Customer atau Perusahaan..."
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
                <div>Memuat data pelanggan...</div>
            ) : (
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '10px' }}>Kode Customer</th>
                                    <th style={{ padding: '10px' }}>Nama Perusahaan</th>
                                    <th style={{ padding: '10px' }}>Email</th>
                                    <th style={{ padding: '10px' }}>Telepon</th>
                                    <th style={{ padding: '10px' }}>Status</th>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '15px', textAlign: 'center' }}>Tidak ada data pelanggan</td>
                                    </tr>
                                ) : (
                                    customers.map((c) => {
                                        const isActive = c.is_active === 1 || c.is_active === true;
                                        return (
                                            <tr key={c.customer_id} style={{ borderBottom: '1px solid #e9ecef' }}>
                                                <td style={{ padding: '10px', fontWeight: 'bold' }}>{c.customer_code}</td>
                                                <td style={{ padding: '10px' }}>{c.company_name}</td>
                                                <td style={{ padding: '10px' }}>{c.email || '-'}</td>
                                                <td style={{ padding: '10px' }}>{c.phone || '-'}</td>
                                                <td style={{ padding: '10px', color: isActive ? '#198754' : '#ef4444', fontWeight: 'bold' }}>
                                                    {isActive ? 'Aktif' : 'Nonaktif'}
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => handleToggleStatus(c)}
                                                        disabled={updatingId === c.customer_id}
                                                        style={{
                                                            padding: '5px 10px',
                                                            fontSize: '12px',
                                                            fontWeight: 'bold',
                                                            borderRadius: '4px',
                                                            border: 'none',
                                                            cursor: updatingId === c.customer_id ? 'not-allowed' : 'pointer',
                                                            backgroundColor: isActive ? '#dc3545' : '#198754',
                                                            color: '#fff'
                                                        }}
                                                    >
                                                        {updatingId === c.customer_id
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

export default CustomerListPage;
