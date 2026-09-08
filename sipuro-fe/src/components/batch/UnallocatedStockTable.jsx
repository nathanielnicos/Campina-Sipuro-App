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
                setError(res?.message || 'Failed to fetch overproduction data.');
            }
        } catch (err) {
            setError('An error occurred while loading data.');
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
        if (!targetAllocId) return alert('Select the target PO / Batch to supply.');
        const inputQty = Number(qtyToAllocate);
        if (!inputQty || inputQty <= 0) return alert('Allocated quantity must be greater than 0.');
        if (inputQty > selectedStock.qty_available) return alert('Allocated quantity exceeds available overproduction stock.');

        if (!window.confirm('Are you sure you want to move this overproduction stock to the selected target batch/PO?')) {
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
            alert('Allocation Failed: ' + (res?.message || 'An error occurred.'));
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
                    Loading data...
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
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Search Source Batch / Product</label>
                    <input
                        type="text"
                        placeholder="Example: BAT260824003"
                        value={searchStock}
                        onChange={handleStockSearchChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Production Date</label>
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
                        Reset Filters
                    </button>
                </div>
            </div>

            {/* Tabel Data Lebihan */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                <th style={{ padding: '12px 16px' }}>Source Batch Number</th>
                                <th style={{ padding: '12px 16px' }}>Product Code</th>
                                <th style={{ padding: '12px 16px' }}>Product Name</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Production Date</th>
                                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Qty (Pcs)</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {unallocatedList.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                        No overproduction stock available.
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
                                                Allocate
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
                            <h3>Allocate Overproduction Stock</h3>
                            <p style={{ fontSize: '13px', color: '#555' }}>
                                Source Batch: <strong>{selectedStock.batch_number}</strong> | Available: <strong>{formatQty(selectedStock.qty_available)} Pcs</strong>
                            </p>

                            <form onSubmit={handleSubmitReallocate}>
                                <div style={{ marginBottom: '12px' }}>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Select Target Batch / PO (Shortage):</label>
                                    {loadingAlloc ? (
                                        <p>Searching for target allocation...</p>
                                    ) : (
                                        <select
                                            value={targetAllocId}
                                            onChange={(e) => setTargetAllocId(e.target.value)}
                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                                            required
                                        >
                                            <option value="">-- Select Target Batch / PO --</option>
                                            {openAllocations.map((alloc) => (
                                                <option key={alloc.allocation_id} value={alloc.allocation_id}>
                                                    PO: {alloc.po_number} | Batch: {alloc.batch_number} (Shortage: {formatQty(alloc.remaining_qty)} Pcs)
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Transferred Quantity:</label>
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
                                    <button type="button" onClick={handleCloseModal} style={{ padding: '8px 16px', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                                    <button type="submit" disabled={submitting} style={{ padding: '8px 16px', background: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                        {submitting ? 'Processing...' : 'Save Allocation'}
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
