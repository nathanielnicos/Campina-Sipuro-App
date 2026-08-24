import React, { useState, useEffect, useCallback } from 'react';
import { fetchPOListApi } from '../../services/poApi';
import PORow from './PORow';
import PaginationControl from '../common/PaginationControl';

const POList = ({ customerId = 1, onCreateNewPO, onSelectPODetail, user }) => {
    const [poList, setPoList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // State Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const getPOList = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const result = await fetchPOListApi(customerId, currentPage, pageSize);

            if (result.success) {
                setPoList(result.data);
                if (result.pagination) {
                    setTotalPages(result.pagination.totalPages);
                    setTotalItems(result.pagination.totalItems);
                }
            } else {
                setError(result.message || 'Gagal mengambil data PO.');
            }
        } catch (err) {
            console.error('Error fetching PO:', err);
            setError('Terjadi kesalahan jaringan atau server mati.');
        } finally {
            setLoading(false);
        }
    }, [customerId, currentPage, pageSize]);

    useEffect(() => {
        getPOList();
    }, [getPOList]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleLimitChange = (newLimit) => {
        setPageSize(newLimit);
        setCurrentPage(1);
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Daftar Purchase Order (PO)</h2>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {user?.role === 'CUSTOMER' && (
                        <button
                            onClick={onCreateNewPO}
                            style={{
                                padding: '10px 16px',
                                backgroundColor: '#007bff',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            + Create New PO
                        </button>
                    )}
                </div>
            </div>

            {loading && <p>Memuat data PO...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && (
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '12px 16px' }}>Kode PO</th>
                                    <th style={{ padding: '12px 16px' }}>Tanggal Dibuat</th>
                                    <th style={{ padding: '12px 16px' }}>Tanggal Kirim Diminta</th>
                                    <th style={{ padding: '12px 16px' }}>Total Item</th>
                                    <th style={{ padding: '12px 16px' }}>Total Harga (Inc. PPN)</th>
                                    <th style={{ padding: '12px 16px' }}>Status</th>
                                    <th style={{ padding: '12px 16px' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {poList.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                            Belum ada Purchase Order yang dibuat.
                                        </td>
                                    </tr>
                                ) : (
                                    poList.map((po) => (
                                        <PORow
                                            key={po.po_header_id}
                                            po={po}
                                            user={user}
                                            onSelectPODetail={onSelectPODetail}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Reusable Pagination Component */}
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

export default POList;
