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
    // Pagination untuk Tabel Utama (Data Excel)
    const [mainCurrentPage, setMainCurrentPage] = useState(1);
    const [mainPageSize, setMainPageSize] = useState(10);

    // Pagination untuk Tabel Kelebihan Stok
    const [unallocCurrentPage, setUnallocCurrentPage] = useState(1);
    const [unallocPageSize, setUnallocPageSize] = useState(10);

    if (!isOpen || !previewData) return null;

    const previewResults = previewData.previewResults || [];
    const unallocatedStocks = previewData.unallocatedStocks || [];

    // Hitung berapa baris yang "Terdaftar"
    const registeredCount = previewResults.filter(item => item.isRegistered).length;
    const canSave = registeredCount > 0 && !previewData.isReupload;

    // Kalkulasi Pagination Tabel Utama
    const mainTotalItems = previewResults.length;
    const mainTotalPages = Math.ceil(mainTotalItems / mainPageSize) || 1;
    const paginatedResults = previewResults.slice(
        (mainCurrentPage - 1) * mainPageSize,
        mainCurrentPage * mainPageSize
    );

    // Kalkulasi Pagination Tabel Kelebihan Stok
    const unallocTotalItems = unallocatedStocks.length;
    const unallocTotalPages = Math.ceil(unallocTotalItems / unallocPageSize) || 1;
    const paginatedUnallocated = unallocatedStocks.slice(
        (unallocCurrentPage - 1) * unallocPageSize,
        unallocCurrentPage * unallocPageSize
    );

    const handleQtyInputChange = (actualIndex, e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        if (onFulfilledChange) {
            onFulfilledChange(actualIndex, rawValue);
        }
    };

    const renderStatusBadge = (isRegistered) => {
        const badgeBaseStyle = {
            display: 'block',
            width: '100%',
            padding: '4px 0',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            textAlign: 'center',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap'
        };

        if (isRegistered) {
            return <span style={{ ...badgeBaseStyle, backgroundColor: '#198754', color: '#fff' }}>TERDAFTAR</span>;
        }
        return <span style={{ ...badgeBaseStyle, backgroundColor: '#dc3545', color: '#fff' }}>TIDAK TERDAFTAR</span>;
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
                maxWidth: '1100px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                margin: 'auto'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' }}>
                    Preview Hasil Produksi (Belum Disimpan)
                </h3>

                {previewData.isReupload && (
                    <div style={{
                        padding: '10px 12px', backgroundColor: '#fff3cd', color: '#856404',
                        borderRadius: '4px', marginBottom: '12px', fontSize: '13px'
                    }}>
                        ⚠️ <strong>Peringatan Unggah Ulang:</strong> {previewData.warningMessage}
                    </div>
                )}

                <div style={{
                    fontSize: '13px', backgroundColor: '#e9ecef', padding: '10px 12px',
                    borderRadius: '4px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between'
                }}>
                    <div>
                        <strong>Nama File:</strong> {previewData.fileName} | <strong>Waktu Proses:</strong> {previewData.processTimestamp}
                    </div>
                    <div>
                        <strong>Terdaftar:</strong> <span style={{ color: '#198754', fontWeight: 'bold' }}>{registeredCount}</span> / {mainTotalItems} Baris
                    </div>
                </div>

                {/* Area Scrollable Table */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '16px' }}>

                    {/* Tabel Utama: Data Excel */}
                    <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', marginBottom: '20px' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table border="1" cellPadding="6" cellSpacing="0" style={{
                                width: '100%', borderCollapse: 'collapse', fontSize: '12px'
                            }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f1f3f5' }}>
                                        <th style={{ textAlign: 'center', width: '120px' }}>Status</th>
                                        <th>No Batch</th>
                                        <th>Produk</th>
                                        <th style={{ textAlign: 'center', width: '100px' }}>Tgl Produksi</th>
                                        <th style={{ textAlign: 'right', width: '90px' }}>Qty Lalu</th>
                                        <th style={{ textAlign: 'right', width: '90px' }}>Qty Excel</th>
                                        <th style={{ textAlign: 'center', width: '120px' }}>Input Tambahan</th>
                                        <th style={{ textAlign: 'right', width: '100px' }}>Total Akumulasi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedResults.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                                Tidak ada data preview alokasi.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedResults.map((item, localIdx) => {
                                            const actualIndex = (mainCurrentPage - 1) * mainPageSize + localIdx;
                                            const formattedActDate = item.actDate ? item.actDate.split('T')[0] : '-';

                                            const productTitle = item.productName
                                                ? `${item.productCode} - ${item.productName}`
                                                : item.productCode || '-';

                                            const currentInputQty = Number(item.fulfilledQty) || 0;
                                            const previousQty = Number(item.previousFulfilledQty) || 0;
                                            const totalAccumulated = previousQty + currentInputQty;

                                            return (
                                                <tr key={actualIndex} style={{
                                                    backgroundColor: item.isRegistered ? '#ffffff' : '#ffebee'
                                                }}>
                                                    <td style={{ textAlign: 'center', padding: '6px' }}>
                                                        {renderStatusBadge(item.isRegistered)}
                                                    </td>
                                                    <td style={{ fontWeight: 'bold' }}>{item.batchNumber}</td>
                                                    <td>{productTitle}</td>
                                                    <td style={{ textAlign: 'center' }}>{formattedActDate}</td>
                                                    <td style={{ textAlign: 'right', color: '#6c757d' }}>
                                                        {formatQty(previousQty)}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                        {formatQty(item.totalQtyOutput)}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="text"
                                                            value={item.fulfilledQty !== undefined ? formatQty(item.fulfilledQty) : ''}
                                                            onChange={(e) => handleQtyInputChange(actualIndex, e)}
                                                            disabled={!item.isRegistered}
                                                            style={{
                                                                width: '90px',
                                                                padding: '4px',
                                                                textAlign: 'right',
                                                                fontWeight: 'bold',
                                                                backgroundColor: !item.isRegistered ? '#e9ecef' : '#fff'
                                                            }}
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#0d6efd' }}>
                                                        {formatQty(totalAccumulated)}
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
                                currentPage: mainCurrentPage,
                                totalPages: mainTotalPages,
                                totalItems: mainTotalItems,
                                limit: mainPageSize
                            }}
                            onPageChange={(p) => setMainCurrentPage(p)}
                            onLimitChange={(l) => { setMainPageSize(l); setMainCurrentPage(1); }}
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
                                                <th>No Batch</th>
                                                <th>Produk</th>
                                                <th style={{ textAlign: 'right' }}>Kuantitas Sisa (PCS)</th>
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
                                                        <td style={{ fontWeight: 'bold' }}>{stk.batchNumber}</td>
                                                        <td>{productDisplay}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                            {formatQty(stk.qtyAvailable)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

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

                {/* Footer Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #dee2e6' }}>
                    <button
                        onClick={onRejectPreview}
                        disabled={saving}
                        style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Tutup
                    </button>

                    {canSave && (
                        <button
                            onClick={onConfirmSave}
                            disabled={saving}
                            style={{ padding: '8px 16px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {saving ? 'Menyimpan...' : 'Simpan Ke Database'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductionPreviewModal;
