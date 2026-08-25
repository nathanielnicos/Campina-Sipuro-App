import React, { useState } from 'react';
import PaginationControl from '../common/PaginationControl';
import { fetchOpenAllocationsByProduct, reallocateStockApi } from '../../services/ppicApi';

const formatQty = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return Number(value).toLocaleString('id-ID');
};

const UnallocatedStockTable = ({
    unallocatedList = [],
    pagination = {},
    onPageChange,
    onLimitChange,
    onRefresh
}) => {
    const [selectedStock, setSelectedStock] = useState(null);
    const [openAllocations, setOpenAllocations] = useState([]);
    const [targetAllocId, setTargetAllocId] = useState('');
    const [qtyToAllocate, setQtyToAllocate] = useState('');
    const [loadingAlloc, setLoadingAlloc] = useState(false);
    const [submitting, setSubmitting] = useState(false);

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
        if (!targetAllocId) return alert('Pilih target PO / Batch yang akan disuplay!');
        const inputQty = Number(qtyToAllocate);
        if (!inputQty || inputQty <= 0) return alert('Qty alokasi harus lebih dari 0');
        if (inputQty > selectedStock.qty_available) return alert('Qty alokasi melebihi stok lebihan yang tersedia!');

        const payload = {
            unallocatedId: selectedStock.id,
            targetAllocationId: targetAllocId,
            allocateQty: inputQty
        };

        setSubmitting(true);
        const res = await reallocateStockApi(payload);
        setSubmitting(false);

        if (res && res.success) {
            alert(res.message);
            handleCloseModal();
            onRefresh();
        } else {
            alert('Gagal Alokasi: ' + (res?.message || 'Terjadi kesalahan.'));
        }
    };

    return (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                            <th style={{ padding: '12px 16px' }}>No. Batch Asal</th>
                            <th style={{ padding: '12px 16px' }}>Kode Produk</th>
                            <th style={{ padding: '12px 16px' }}>Nama Produk</th>
                            <th style={{ padding: '12px 16px' }}>Tgl Produksi</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Qty Lebihan (Sisa)</th>
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
                                    <td style={{ padding: '12px 16px' }}>{item.production_date ? item.production_date.split('T')[0] : '-'}</td>
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

            {/* Reusable Pagination Component */}
            <PaginationControl
                pagination={pagination}
                onPageChange={onPageChange}
                onLimitChange={onLimitChange}
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
    );
};

export default UnallocatedStockTable;
