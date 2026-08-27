import React, { useState } from 'react';
import { formatQty } from '../../utils/formatters';
import PaginationControl from '../common/PaginationControl';

const ProductionPreviewModal = ({
    isOpen,
    previewData,
    saving,
    onFulfilledChange,
    onConfirmSave,
    onRejectPreview
}) => {
    // State Pagination Tabel Realisasi PO
    const [allocCurrentPage, setAllocCurrentPage] = useState(1);
    const [allocPageSize, setAllocPageSize] = useState(10);

    // State Pagination Tabel Kelebihan Stok
    const [unallocCurrentPage, setUnallocCurrentPage] = useState(1);
    const [unallocPageSize, setUnallocPageSize] = useState(10);

    if (!isOpen || !previewData) return null;

    // Kalkulasi Pagination Realisasi PO
    const previewResults = previewData.previewResults || [];
    const allocTotalItems = previewResults.length;
    const allocTotalPages = Math.ceil(allocTotalItems / allocPageSize) || 1;
    const paginatedAllocations = previewResults.slice(
        (allocCurrentPage - 1) * allocPageSize,
        allocCurrentPage * allocPageSize
    );

    // Kalkulasi Pagination Kelebihan Stok
    const unallocatedStocks = previewData.unallocatedStocks || [];
    const unallocTotalItems = unallocatedStocks.length;
    const unallocTotalPages = Math.ceil(unallocTotalItems / unallocPageSize) || 1;
    const paginatedUnallocated = unallocatedStocks.slice(
        (unallocCurrentPage - 1) * unallocPageSize,
        unallocCurrentPage * unallocPageSize
    );

    // Handler Input Qty (Kirim angka murni ke state parent)
    const handleQtyInputChange = (actualIndex, e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        onFulfilledChange(actualIndex, rawValue);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: '8px',
                width: '90%',
                maxWidth: '950px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                margin: 'auto'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Preview Hasil Produksi (Belum Disimpan)</h3>

                {previewData.isReupload && (
                    <div style={{
                        padding: '12px', backgroundColor: '#fff3cd', color: '#856404',
                        borderRadius: '4px', marginBottom: '16px', fontSize: '13px'
                    }}>
                        ⚠️ <strong>Peringatan Unggah Ulang:</strong> {previewData.warningMessage}
                    </div>
                )}

                <div style={{
                    fontSize: '13px', backgroundColor: '#e9ecef', padding: '10px',
                    borderRadius: '4px', marginBottom: '16px'
                }}>
                    <strong>Nama File:</strong> {previewData.fileName} | <strong>Waktu Proses:</strong> {previewData.processTimestamp}
                </div>

                {/* Area Scroll Tabel */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '16px' }}>

                    {/* Tabel Realisasi PO */}
                    <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', marginBottom: '20px' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table border="1" cellPadding="6" cellSpacing="0" style={{
                                width: '100%', borderCollapse: 'collapse', fontSize: '13px'
                            }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f1f3f5' }}>
                                        <th>No PO</th>
                                        <th>Produk</th>
                                        <th>No Batch</th>
                                        <th style={{ textAlign: 'center', width: '100px' }}>Tgl Rencana</th>
                                        <th style={{ textAlign: 'center', width: '100px' }}>Tgl Aktual</th>
                                        <th style={{ textAlign: 'center' }}>Kuantitas Target (PCS)</th>
                                        <th style={{ textAlign: 'center', width: '110px' }}>Kuantitas Terpenuhi (PCS)</th>
                                        <th style={{ textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedAllocations.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                                Tidak ada data preview alokasi.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedAllocations.map((item, localIdx) => {
                                            const actualIndex = (allocCurrentPage - 1) * allocPageSize + localIdx;
                                            const formattedPlanDate = item.planDate ? item.planDate.split('T')[0] : '-';
                                            const formattedActDate = item.actDate ? item.actDate.split('T')[0] : '-';

                                            const productTitle = item.productName
                                                ? `${item.productCode} - ${item.productName}`
                                                : item.productCode;

                                            return (
                                                <tr key={actualIndex}>
                                                    <td><strong>{item.poNumber}</strong></td>
                                                    <td>{productTitle}</td>
                                                    <td>{item.batchNumber}</td>
                                                    <td style={{ textAlign: 'center', width: '100px' }}>{formattedPlanDate}</td>
                                                    <td style={{
                                                        textAlign: 'center', width: '100px',
                                                        color: formattedPlanDate !== formattedActDate ? '#d9534f' : 'inherit'
                                                    }}>
                                                        {formattedActDate}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>{formatQty(item.allocatedQty)}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="text"
                                                            value={item.fulfilledQty ? formatQty(item.fulfilledQty) : ''}
                                                            onChange={(e) => handleQtyInputChange(actualIndex, e)}
                                                            style={{ width: '90px', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span style={{
                                                            padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                                                            backgroundColor: item.rowStatus === 'Close' ? '#d4edda' : '#fff3cd',
                                                            color: item.rowStatus === 'Close' ? '#155724' : '#856404'
                                                        }}>
                                                            {item.rowStatus}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Realisasi PO */}
                        <PaginationControl
                            pagination={{
                                currentPage: allocCurrentPage,
                                totalPages: allocTotalPages,
                                totalItems: allocTotalItems,
                                limit: allocPageSize
                            }}
                            onPageChange={(p) => setAllocCurrentPage(p)}
                            onLimitChange={(l) => { setAllocPageSize(l); setAllocCurrentPage(1); }}
                        />
                    </div>

                    {/* Tabel Kelebihan Stok Produksi */}
                    {unallocatedStocks.length > 0 && (
                        <div>
                            <h4 style={{ marginBottom: '8px', color: '#856404' }}>Kelebihan Produksi</h4>
                            <div style={{ border: '1px solid #ffeeba', borderRadius: '4px', backgroundColor: '#fff3cd' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table border="1" cellPadding="6" cellSpacing="0" style={{
                                        width: '100%', borderCollapse: 'collapse', fontSize: '13px'
                                    }}>
                                        <thead>
                                            <tr>
                                                <th>Produk</th>
                                                <th>No Batch</th>
                                                <th style={{ textAlign: 'right' }}>Kuantitas (PCS)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedUnallocated.map((stk, sIdx) => {
                                                const code = stk.productCode || stk.itemCode || '';
                                                const name = stk.productName || '';

                                                let productDisplay = code;
                                                if (code && name) {
                                                    productDisplay = `${code} - ${name}`;
                                                } else if (name) {
                                                    productDisplay = name;
                                                }

                                                return (
                                                    <tr key={sIdx}>
                                                        <td>{productDisplay}</td>
                                                        <td>{stk.batchNumber}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatQty(stk.qtyAvailable)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Kelebihan Stok */}
                                <PaginationControl
                                    pagination={{
                                        currentPage: unallocCurrentPage,
                                        totalPages: unallocTotalPages,
                                        totalItems: unallocTotalItems,
                                        limit: unallocPageSize
                                    }}
                                    onPageChange={(p) => setUnallocCurrentPage(p)}
                                    onLimitChange={(l) => { setUnallocPageSize(l); setUnallocCurrentPage(1); }}
                                />
                            </div>
                        </div>
                    )}

                </div>

                {/* Tombol Aksi */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #dee2e6' }}>
                    <button
                        onClick={onRejectPreview}
                        disabled={saving}
                        style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Tolak / Batal
                    </button>
                    <button
                        onClick={onConfirmSave}
                        disabled={saving}
                        style={{ padding: '8px 16px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {saving ? 'Menyimpan...' : 'Terima & Simpan Data'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductionPreviewModal;
