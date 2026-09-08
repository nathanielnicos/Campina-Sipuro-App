import { useState, useEffect, useCallback } from 'react';
import {
    fetchUnassignedSummary,
    fetchBatchesBySku,
    assignBatchBulk
} from '../../services/batchApi';
import { formatQty } from '../../utils/formatters';
import PaginationControl from '../common/PaginationControl';
import BatchAllocationModal from './BatchAllocationModal';

const PendingSkuTable = ({ currentUser, reloadTrigger, onRefreshAll }) => {
    const currentUserId = currentUser?.employee_id || currentUser?.id;

    // State internal untuk Data, Loading, & Error
    const [summaryList, setSummaryList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // State internal Filter
    const [searchProduct, setSearchProduct] = useState('');
    const [searchPo, setSearchPo] = useState('');

    // State internal Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 10 });

    // State internal Modal Alokasi Batch
    const [selectedSku, setSelectedSku] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [allocationMode, setAllocationMode] = useState('');
    const [existingBatches, setExistingBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [allocatedQty, setAllocatedQty] = useState('');
    const [batchCode, setBatchCode] = useState('');
    const [productionDate, setProductionDate] = useState('');
    const [expiredDate, setExpiredDate] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Fungsi Fetch Data API
    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const filters = { searchProduct, searchPo };
            const res = await fetchUnassignedSummary(page, limit, filters);
            if (res && res.success) {
                setSummaryList(res.data || []);
                if (res.pagination) {
                    setPagination({
                        currentPage: Number(res.pagination.currentPage) || 1,
                        totalPages: Number(res.pagination.totalPages) || 1,
                        totalItems: Number(res.pagination.totalItems) || 0,
                        limit: Number(res.pagination.limit) || 10
                    });
                }
            } else {
                setError(res?.message || 'Failed to fetch batch summary data.');
            }
        } catch (err) {
            setError('An error occurred while loading data.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, searchProduct, searchPo]);

    // Re-fetch saat filter, page, limit, atau reloadTrigger berubah
    useEffect(() => {
        loadData();
    }, [loadData, reloadTrigger]);

    // Handler Filter
    const handleProductChange = (e) => {
        setSearchProduct(e.target.value);
        setPage(1);
    };

    const handlePoChange = (e) => {
        setSearchPo(e.target.value);
        setPage(1);
    };

    const handleResetFilters = () => {
        setSearchProduct('');
        setSearchPo('');
        setPage(1);
    };

    // Handler Modal Alokasi Batch
    const handleOpenModal = async (sku) => {
        setSelectedSku(sku);
        setAllocatedQty(sku.total_qty_needed);
        setAllocationMode('');
        setSelectedBatchId('');
        setBatchCode('');
        setProductionDate(new Date().toISOString().split('T')[0]);
        setExpiredDate('');

        const res = await fetchBatchesBySku(sku.id_product);
        if (res && res.success) {
            setExistingBatches(res.data || []);
        } else {
            setExistingBatches([]);
        }

        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedSku(null);
    };

    const handleSelectBatchExisting = (e) => {
        const batchId = e.target.value;
        setSelectedBatchId(batchId);
        const found = existingBatches.find(b => String(b.id_batch) === String(batchId));
        if (found) {
            setBatchCode(found.batch_number);
            setProductionDate(found.plan_production_date ? found.plan_production_date.split('T')[0] : '');
            setExpiredDate(found.expired_date ? found.expired_date.split('T')[0] : '');
        } else {
            setBatchCode('');
            setProductionDate('');
            setExpiredDate('');
        }
    };

    const handleSubmitBatch = async (e) => {
        e.preventDefault();

        if (!allocationMode) return alert('Please select an allocation option.');

        const inputQty = Number(allocatedQty);
        if (!inputQty || inputQty <= 0) return alert('Allocation quantity must be greater than 0.');
        if (inputQty > selectedSku.total_qty_needed) return alert(`Entered quantity (${inputQty}) exceeds total remaining demand (${selectedSku.total_qty_needed}).`);

        if (allocationMode === 'NEW' && (!batchCode || !productionDate)) return alert('Batch number and production date are required.');
        if (allocationMode === 'EXISTING' && !selectedBatchId) return alert('Please select an existing batch.');

        const payload = {
            id_product: selectedSku.id_product,
            allocation_mode: allocationMode,
            selected_batch_id: selectedBatchId || null,
            batch_number: batchCode,
            plan_production_date: productionDate,
            expired_date: expiredDate || null,
            allocated_qty: inputQty,
            created_by: currentUserId
        };

        setSubmitting(true);
        const res = await assignBatchBulk(payload);
        setSubmitting(false);

        if (res && res.success) {
            alert(res.message);
            handleCloseModal();
            loadData();
            if (onRefreshAll) onRefreshAll(); // Beri tahu parent untuk trigger reload tab lain jika perlu
        } else {
            alert('Allocation Failed: ' + (res?.message || 'An error occurred while allocating the batch.'));
        }
    };

    const isFilterActive = Boolean(searchProduct || searchPo);
    const isPoFilterActive = Boolean(searchPo && searchPo.trim() !== '');

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

            {/* Filter Bar Tab 1 */}
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
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Search Product Code/Name</label>
                    <input
                        type="text"
                        placeholder="Example: FG-CN-00060"
                        value={searchProduct}
                        onChange={handleProductChange}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Search PO Number</label>
                    <input
                        type="text"
                        placeholder="Example: PO-20260824-895"
                        value={searchPo}
                        onChange={handlePoChange}
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

            {/* Tabel Data */}
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                <th style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>Product Code</th>
                                <th style={{ padding: '12px 10px' }}>Product Name</th>
                                <th style={{ padding: '12px 10px', textAlign: 'right', wordBreak: 'break-word' }}>Total Required Qty (Pcs)</th>
                                <th style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>PO Count</th>
                                <th style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>PO Number</th>
                                <th style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>PO Qty (Pcs)</th>
                                <th style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap', width: '140px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryList.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                        No SKUs need to be allocated at this time.
                                    </td>
                                </tr>
                            ) : (
                                summaryList.map((row) => {
                                    const poItems = row.po_numbers
                                        ? row.po_numbers.split('\n').filter(Boolean)
                                        : [];

                                    return (
                                        <tr key={row.id_product} style={{ borderBottom: '1px solid #dee2e6' }}>
                                            <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                <strong>{row.product_code}</strong>
                                            </td>
                                            <td style={{ padding: '12px 10px', verticalAlign: 'middle', wordBreak: 'break-word' }}>
                                                {row.product_name}
                                            </td>
                                            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                                                {formatQty(row.total_qty_needed)}
                                            </td>
                                            <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                {formatQty(row.total_po_count)}
                                            </td>

                                            <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                                                {poItems.length > 0 ? (
                                                    poItems.map((item, idx) => {
                                                        const poNumber = item.split(' (')[0];
                                                        return <div key={idx} style={{ fontWeight: '500' }}>{poNumber}</div>;
                                                    })
                                                ) : (
                                                    '-'
                                                )}
                                            </td>

                                            <td style={{ padding: '12px 10px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                                                {poItems.length > 0 ? (
                                                    poItems.map((item, idx) => {
                                                        const match = item.match(/\((.*?)\)/);
                                                        const rawContent = match ? match[1] : '';
                                                        const numericPart = rawContent.split(' ')[0];
                                                        const formattedQty = numericPart ? formatQty(numericPart) : '-';

                                                        return (
                                                            <div key={idx}>
                                                                {formattedQty}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    '-'
                                                )}
                                            </td>

                                            <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                <button
                                                    onClick={() => handleOpenModal(row)}
                                                    disabled={isPoFilterActive}
                                                    title={isPoFilterActive ? "Reset PO number filter for batch allocation" : ""}
                                                    style={{
                                                        backgroundColor: isPoFilterActive ? '#6c757d' : '#0d6efd',
                                                        color: '#fff',
                                                        border: 'none',
                                                        padding: '6px 12px',
                                                        borderRadius: '4px',
                                                        cursor: isPoFilterActive ? 'not-allowed' : 'pointer',
                                                        fontWeight: '600',
                                                        fontSize: '12px',
                                                        whiteSpace: 'nowrap',
                                                        display: 'inline-block',
                                                        opacity: isPoFilterActive ? 0.65 : 1
                                                    }}
                                                >
                                                    + Allocate Batch
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
                    pagination={pagination}
                    onPageChange={(newPage) => setPage(newPage)}
                    onLimitChange={(newLimit) => {
                        setLimit(newLimit);
                        setPage(1);
                    }}
                />
            </div>

            {/* Modal Alokasi Batch */}
            <BatchAllocationModal
                isOpen={isModalOpen}
                selectedSku={selectedSku}
                allocatedQty={allocatedQty}
                setAllocatedQty={setAllocatedQty}
                allocationMode={allocationMode}
                setAllocationMode={setAllocationMode}
                existingBatches={existingBatches}
                selectedBatchId={selectedBatchId}
                batchCode={batchCode}
                setBatchCode={setBatchCode}
                productionDate={productionDate}
                setProductionDate={setProductionDate}
                // expiredDate={expiredDate}
                // setExpiredDate={setExpiredDate}
                submitting={submitting}
                onSelectBatchExisting={handleSelectBatchExisting}
                onSubmit={handleSubmitBatch}
                onClose={handleCloseModal}
            />
        </div>
    );
};

export default PendingSkuTable;
