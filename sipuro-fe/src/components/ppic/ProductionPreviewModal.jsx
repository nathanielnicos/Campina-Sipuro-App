import React, { useState } from 'react';
import { formatQty } from '../../utils/formatters';

const ProductionPreviewModal = ({
    isOpen,
    previewData,
    saving,
    onConfirmSave,
    onRejectPreview
}) => {
    const [activeTab, setActiveTab] = useState('ALLOCATED');

    if (!isOpen || !previewData) return null;

    const {
        previewResults = [],
        unallocatedStocks = [],
        fileName,
        processTimestamp,
        isReupload,
        warningMessage
    } = previewData;

    const allocatedCount = previewResults.length;
    const unallocatedCount = unallocatedStocks.length;

    // Tombol simpan aktif jika ada alokasi PO atau stok lebihan yang siap disimpan
    const canSave = allocatedCount > 0 || unallocatedCount > 0;

    const renderStatusBadge = (status) => {
        const badgeStyle = {
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'inline-block',
            textAlign: 'center'
        };

        if (status === 'Close') {
            return <span style={{ ...badgeStyle, backgroundColor: '#d1e7dd', color: '#0f5132' }}>Full / Close</span>;
        }
        return <span style={{ ...badgeStyle, backgroundColor: '#fff3cd', color: '#664d03' }}>Partial / Open</span>;
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center',
            alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff', borderRadius: '8px', width: '95%',
                maxWidth: '1100px', maxHeight: '90vh', display: 'flex',
                flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #dee2e6' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                        Preview Alokasi FIFO Produksi (Belum Disimpan)
                    </h3>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                        File: <strong>{fileName}</strong> | Waktu Waktu: {processTimestamp}
                    </div>
                    {isReupload && (
                        <div style={{ marginTop: '8px', padding: '6px 12px', backgroundColor: '#fff3cd', color: '#664d03', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                            ⚠️ {warningMessage}
                        </div>
                    )}
                </div>

                {/* Filter Tabs Header */}
                <div style={{
                    padding: '10px 20px', display: 'flex', gap: '8px',
                    alignItems: 'center', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef'
                }}>
                    <button
                        onClick={() => setActiveTab('ALLOCATED')}
                        style={{
                            padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '12px',
                            backgroundColor: activeTab === 'ALLOCATED' ? '#0d6efd' : '#e9ecef',
                            color: activeTab === 'ALLOCATED' ? '#fff' : '#495057'
                        }}
                    >
                        Alokasi PO ({allocatedCount})
                    </button>
                    <button
                        onClick={() => setActiveTab('UNALLOCATED')}
                        style={{
                            padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '12px',
                            backgroundColor: activeTab === 'UNALLOCATED' ? '#fd7e14' : '#ffe8cc',
                            color: activeTab === 'UNALLOCATED' ? '#fff' : '#853b00'
                        }}
                    >
                        Stok Lebihan ({unallocatedCount})
                    </button>
                </div>

                {/* Table Body */}
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                    {activeTab === 'ALLOCATED' ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '8px', width: '120px' }}>No PO</th>
                                    <th style={{ padding: '8px' }}>Produk</th>
                                    <th style={{ padding: '8px', width: '120px' }}>No Batch</th>
                                    <th style={{ padding: '8px', textAlign: 'center', width: '100px' }}>Tgl Aktual</th>
                                    <th style={{ padding: '8px', textAlign: 'right', width: '110px' }}>Qty Terpenuhi</th>
                                    <th style={{ padding: '8px', textAlign: 'center', width: '110px' }}>Status Baris</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewResults.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                                            Tidak ada alokasi PO yang cocok dengan produksi ini.
                                        </td>
                                    </tr>
                                ) : (
                                    previewResults.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #e9ecef' }}>
                                            <td style={{ padding: '8px', fontWeight: 'bold' }}>{item.poNumber}</td>
                                            <td style={{ padding: '8px' }}>{item.productCode} - {item.productName}</td>
                                            <td style={{ padding: '8px' }}>{item.batchNumber}</td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>{item.actDate || '-'}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#198754' }}>
                                                {formatQty(item.fulfilledQty)}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                {renderStatusBadge(item.rowStatus)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ padding: '8px', width: '140px' }}>No Batch</th>
                                    <th style={{ padding: '8px' }}>Kode / Nama Produk</th>
                                    <th style={{ padding: '8px', textAlign: 'center', width: '120px' }}>Tgl Produksi</th>
                                    <th style={{ padding: '8px', textAlign: 'right', width: '120px' }}>Qty Lebihan</th>
                                    <th style={{ padding: '8px', width: '200px' }}>Keterangan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unallocatedStocks.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                                            Tidak ada stok lebihan.
                                        </td>
                                    </tr>
                                ) : (
                                    unallocatedStocks.map((stock, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #e9ecef', backgroundColor: '#fff9db' }}>
                                            <td style={{ padding: '8px', fontWeight: 'bold' }}>{stock.batchNumber}</td>
                                            <td style={{ padding: '8px' }}>{stock.productCode || '-'} - {stock.productName || '-'}</td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>{stock.productionDate || '-'}</td>
                                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#d9480f' }}>
                                                {formatQty(stock.qtyAvailable)}
                                            </td>
                                            <td style={{ padding: '8px', fontSize: '12px', color: '#853b00' }}>
                                                {stock.isNewUnregisteredBatch ? 'Batch/SKU Tidak Terdaftar di DB' : 'Kelebihan Hasil Produksi'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer Buttons */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid #dee2e6', display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: '#fff' }}>
                    <button
                        onClick={onRejectPreview}
                        disabled={saving}
                        style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
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
