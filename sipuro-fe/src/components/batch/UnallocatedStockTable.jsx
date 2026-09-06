import { useState, useEffect, useCallback } from 'react';
import PaginationControl from '../common/PaginationControl';
import { fetchUnallocatedStocks, fetchOpenAllocationsByProduct, reallocateStockApi } from '../../services/batchApi';
import { formatDate, formatQty } from '../../utils/formatters';

const UnallocatedStockTable = ({ currentUser, reloadTrigger, onRefreshAll }) => {
    // State Data, Loading, Error
    const [unallocatedList, setUnallocatedList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // State Filter
    const [searchStock, setSearchStock] = useState('');
    const [prodDate, setProdDate] = useState('');

    // State Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    // State Modal Alokasi
    const [selectedStock, setSelectedStock] = useState(null);
    const [openAllocations, setOpenAllocations] = useState([]);
    const [targetAllocId, setTargetAllocId] = useState('');
    const [qtyToAllocate, setQtyToAllocate] = useState('');
    const [loadingAlloc, setLoadingAlloc] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Fetch Data API Lebihan Stok
    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = { search: searchStock, prodDate };
            const res = await fetchUnallocatedStocks(page, limit, filters);
            if (res && res.success) {
                setUnallocatedList(res.data || []);
                if (res.pagination) {
                    setPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            } else {
                setError(res?.message || 'Gagal mengambil data stok lebihan.');
            }
        } catch (err) {
            setError('Terjadi kesalahan saat memuat data.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, searchStock, prodDate]);

    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    // Handlers Filter
    const handleStockSearchChange = (e) => {
        setSearchStock(e.target.value);
        setPage(1);
    };

    const handleProdDateChange = (e) => {
        setProdDate(e.target.value);
        setPage(1);
    };

    const handleResetFilters = () => {
        setSearchStock('');
        setProdDate('');
        setPage(1);
    };

    // Handlers Modal & Reallocate
    const handleOpenModal = async (stock) => {
        setSelectedStock(stock);
        setQtyToAllocate(stock.qty_available);
        setTargetAllocId('');
        setLoadingAlloc(true);

        const res = await fetchOpenAllocationsByProduct(stock.id_product);
        if (res && res.success) {
            setOpenAllocations(res.data || []);
        } else {
            setOpenAllocations([]);
        }
        setLoadingAlloc(false);
    };

    const handleCloseModal = () => {
        setSelectedStock(null);
        setOpenAllocations([]);
        setTargetAllocId('');
        setQtyToAllocate('');
    };

    const handleSubmitReallocate = async (e) => {
        e.preventDefault();
        if (!targetAllocId) return alert('Pilih target PO / Batch yang akan disuplai!');
        const inputQty = Number(qtyToAllocate);
        if (!inputQty || inputQty <= 0) return alert('Qty alokasi harus lebih dari 0');
        if (inputQty > selectedStock.qty_available) return alert('Qty alokasi melebihi stok lebihan yang tersedia!');

        if (!window.confirm('Apakah Anda yakin ingin memindahkan stok lebihan ini ke batch/PO target yang dipilih?')) {
            return;
        }

        const currentUserId = currentUser?.employee_id || currentUser?.id;

        const payload = {
            unallocatedId: selectedStock.id,
            targetAllocationId: targetAllocId,
            allocateQty: inputQty,
            userId: currentUserId
        };

        setSubmitting(true);
        const res = await reallocateStockApi(payload);
        setSubmitting(false);

        if (res && res.success) {
            alert(res.message);
            handleCloseModal();
            loadData(); // Reload data lokal tab 3
            if (onRefreshAll) onRefreshAll(); // Trigger reload ke tab lain jika diperlukan
        } else {
            alert('Gagal Alokasi: ' + (res?.message || 'Terjadi kesalahan.'));
        }
    };

    const isFilterActive = Boolean(searchStock || prodDate);

    return (
        <div style={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: -25,
                    right: 10,
                    fontSize: '12px',
                    color: '#0d6efd',
                    fontWeight: 'bold',
                    zIndex: 10
                }}>
                    Memuat data...
                </div>
            )}

            {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}

            {/* Filter Bar Tab 3 */}
            <div style={{
                backgroundColor: '#fff',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid #dee2e6',
                marginBottom: '20px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                alignItems: 'end'
            }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Cari Batch Asal / Produk</label>
                    <input
                        type="text"
                        placeholder="Contoh: BAT260824003"
                        value={searchStock}
                        onChange={handleStockSearchChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Tgl Produksi</label>
                    <input
                        type="date"
                        value={prodDate}
                        onChange={handleProdDateChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <button
                        onClick={handleResetFilters}
                        disabled={!isFilterActive}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: isFilterActive ? '#dc3545' : '#e9ecef',
                            color: isFilterActive ? '#fff' : '#adb5bd',
                            border: isFilterActive ? '1px solid #dc3545' : '1px solid #ced4da',
                            borderRadius: '4px',
                            cursor: isFilterActive ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Reset Filter
                    </button>
                </div>
            </div>

            {/* Tabel Data Lebihan */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                <th style={{ padding: '12px 16px' }}>No. Batch Asal</th>
                                <th style={{ padding: '12px 16px' }}>Kode Produk</th>
                                <th style={{ padding: '12px 16px' }}>Nama Produk</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Tgl Produksi</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Kuantitas (PCS)</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {unallocatedList.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                        Tidak ada stok lebihan produksi.
                                    </td>
                                </tr>
                            ) : (
                                unallocatedList.map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                                        <td style={{ padding: '12px 16px' }}><strong>{item.batch_number}</strong></td>
                                        <td style={{ padding: '12px 16px' }}>{item.product_code || '-'}</td>
                                        <td style={{ padding: '12px 16px' }}>{item.product_name || '-'}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {formatDate(item.production_date)}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#198754', fontWeight: 'bold' }}>
                                            {formatQty(item.qty_available)}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleOpenModal(item)}
                                                style={{ backgroundColor: '#0d6efd', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                                            >
                                                Alokasikan
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <PaginationControl
                    pagination={pagination}
                    onPageChange={(newPage) => setPage(newPage)}
                    onLimitChange={(newLimit) => {
                        setLimit(newLimit);
                        setPage(1);
                    }}
                />

                {/* Modal Alokasi Stok */}
                {selectedStock && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                        <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', width: '500px', maxWidth: '90%' }}>
                            <h3>Alokasikan Lebihan Stok</h3>
                            <p style={{ fontSize: '13px', color: '#555' }}>
                                Sumber Batch: <strong>{selectedStock.batch_number}</strong> | Tersedia: <strong>{formatQty(selectedStock.qty_available)} Pcs</strong>
                            </p>

                            <form onSubmit={handleSubmitReallocate}>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Pilih Target Batch / PO (Kurang):</label>
                                    {loadingAlloc ? (
                                        <p>Mencari alokasi target...</p>
                                    ) : (
                                        <select
                                            value={targetAllocId}
                                            onChange={(e) => setTargetAllocId(e.target.value)}
                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                                            required
                                        >
                                            <option value="">-- Pilih Batch / PO Target --</option>
                                            {openAllocations.map((alloc) => (
                                                <option key={alloc.allocation_id} value={alloc.allocation_id}>
                                                    PO: {alloc.po_number} | Batch Target: {alloc.batch_number} (Kurang: {formatQty(alloc.remaining_qty)} Pcs)
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Qty Dipindahkan:</label>
                                    <input
                                        type="number"
                                        value={qtyToAllocate}
                                        max={selectedStock.qty_available}
                                        onChange={(e) => setQtyToAllocate(e.target.value)}
                                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button type="button" onClick={handleCloseModal} style={{ padding: '8px 16px', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Batal</button>
                                    <button type="submit" disabled={submitting} style={{ padding: '8px 16px', background: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                        {submitting ? 'Proses...' : 'Simpan Alokasi'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnallocatedStockTable;
