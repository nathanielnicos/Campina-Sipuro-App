import React, { useState, useEffect, useCallback } from 'react';
import { fetchPOListApi, exportPoExcelApi } from '../../services/poApi';
import PORow from './PORow';
import POPdfModal from './POPdfModal';
import PaginationControl from '../common/PaginationControl';

const POList = ({ customerId = 1, onCreateNewPO, onSelectPODetail, user }) => {
    const [poList, setPoList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState(false);

    // State Modal PDF Preview
    const [selectedPdfPoId, setSelectedPdfPoId] = useState(null);

    // State Filter & Search
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState('');

    // Cek apakah ada filter yang aktif
    const isFilterActive = Boolean(search || startDate || endDate || status);

    // State Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const getPOList = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const filters = { search, startDate, endDate, status };
            const result = await fetchPOListApi(customerId, currentPage, pageSize, filters);

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
    }, [customerId, currentPage, pageSize, search, startDate, endDate, status]);

    useEffect(() => {
        getPOList();
    }, [getPOList]);

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
        setCurrentPage(1);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
        setCurrentPage(1);
    };

    const handleStatusChange = (e) => {
        setStatus(e.target.value);
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        if (!isFilterActive) return;
        setSearch('');
        setStartDate('');
        setEndDate('');
        setStatus('');
        setCurrentPage(1);
    };

    const handleExportExcel = async () => {
        setExporting(true);
        const filters = { search, startDate, endDate, status };
        await exportPoExcelApi(customerId, filters);
        setExporting(false);
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

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            {/* Filter & Action Bar */}
            <div style={{
                backgroundColor: '#fff',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                marginBottom: '20px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                alignItems: 'flex-end'
            }}>
                {/* Cari PO Number */}
                <div style={{ flex: '1 1 180px', minWidth: '150px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Cari PO Number</label>
                    <input
                        type="text"
                        placeholder="Contoh: 001/PO/..."
                        value={search}
                        onChange={handleSearchChange}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '13px' }}
                    />
                </div>

                {/* Dari Tanggal */}
                <div style={{ flex: '0 0 135px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Dari Tanggal</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={handleStartDateChange}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '12px' }}
                    />
                </div>

                {/* Sampai Tanggal */}
                <div style={{ flex: '0 0 135px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Sampai Tanggal</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={handleEndDateChange}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '12px' }}
                    />
                </div>

                {/* Status PO */}
                <div style={{ flex: '0 0 160px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Status PO</label>
                    <select
                        value={status}
                        onChange={handleStatusChange}
                        style={{ width: '100%', padding: '7px 8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '12px' }}
                    >
                        <option value="">Semua Status</option>
                        <option value="Waiting for Confirmation">Waiting for Confirmation</option>
                        <option value="Waiting Batch Assignment">Waiting Batch Assignment</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Canceled">Canceled</option>
                    </select>
                </div>

                {/* Group Tombol Aksi */}
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    <button
                        onClick={handleResetFilters}
                        disabled={!isFilterActive}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: isFilterActive ? '#dc3545' : '#e9ecef',
                            color: isFilterActive ? '#fff' : '#adb5bd',
                            border: isFilterActive ? '1px solid #dc3545' : '1px solid #ced4da',
                            borderRadius: '4px',
                            cursor: isFilterActive ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Reset Filter
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={exporting}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: '#28a745',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: exporting ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            whiteSpace: 'nowrap',
                            opacity: exporting ? 0.7 : 1
                        }}
                    >
                        {exporting ? 'Exporting...' : '📊 Export Excel'}
                    </button>
                    {user?.role === 'CUSTOMER' && (
                        <button
                            onClick={onCreateNewPO}
                            style={{
                                padding: '8px 12px',
                                backgroundColor: '#007bff',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            + Create PO
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
                                    {user?.role !== 'PPIC' && (
                                        <th style={{ padding: '12px 16px' }}>Total Harga (Inc. PPN)</th>
                                    )}
                                    <th style={{ padding: '12px 16px' }}>Status</th>
                                    <th style={{ padding: '12px 16px' }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {poList.length === 0 ? (
                                    <tr>
                                        <td colSpan={user?.role === 'PPIC' ? "6" : "7"} style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
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
                                            onOpenPdfModal={(poId) => setSelectedPdfPoId(poId)}
                                        />
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

            {/* Render POPdfModal jika ada ID yang dipilih */}
            {selectedPdfPoId && (
                <POPdfModal
                    poId={selectedPdfPoId}
                    onClose={() => setSelectedPdfPoId(null)}
                />
            )}
        </div>
    );
};

export default POList;
