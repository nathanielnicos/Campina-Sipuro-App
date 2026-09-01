import React, { useState } from 'react';
import { formatQty } from '../../utils/formatters';

const ProductionPreviewModal = ({
    isOpen,
    previewData,
    saving,
    onConfirmSave,
    onRejectPreview
}) => {
    const [activeTab, setActiveTab] = useState('ALL');

    if (!isOpen || !previewData) return null;

    const { summary, previewResults = [], fileName, processTimestamp } = previewData;
    const { total = 0, registeredCount = 0, unregisteredCount = 0 } = summary || {};

    // Syarat Tombol Simpan: HANYA tampil jika registeredCount > 0
    const canSave = registeredCount > 0;

    // Filter List berdasarkan Tab Aktif
    const filteredResults = previewResults.filter(item => {
        if (activeTab === 'REGISTERED') return item.status === 'TERDAFTAR';
        if (activeTab === 'UNREGISTERED') return item.status === 'TIDAK_TERDAFTAR';
        return true;
    });

    const renderStatusBadge = (status) => {
        const badgeStyle = {
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'inline-block',
            textAlign: 'center'
        };

        if (status === 'TERDAFTAR') {
            return <span style={{ ...badgeStyle, backgroundColor: '#d1e7dd', color: '#0f5132' }}>Terdaftar</span>;
        }
        return <span style={{ ...badgeStyle, backgroundColor: '#f8d7da', color: '#842029' }}>Tidak Terdaftar</span>;
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
                        Preview Hasil Produksi (Belum Disimpan)
                    </h3>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
                        File: <strong>{fileName}</strong> | Waktu Proses: {processTimestamp}
                    </div>
                </div>

                {/* Filter Tabs Header */}
                <div style={{
                    padding: '10px 20px', display: 'flex', gap: '8px',
                    alignItems: 'center', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef'
                }}>
                    <button
                        onClick={() => setActiveTab('ALL')}
                        style={{
                            padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '12px',
                            backgroundColor: activeTab === 'ALL' ? '#0d6efd' : '#e9ecef',
                            color: activeTab === 'ALL' ? '#fff' : '#495057'
                        }}
                    >
                        Semua ({total})
                    </button>
                    <button
                        onClick={() => setActiveTab('REGISTERED')}
                        style={{
                            padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '12px',
                            backgroundColor: activeTab === 'REGISTERED' ? '#198754' : '#d1e7dd',
                            color: activeTab === 'REGISTERED' ? '#fff' : '#0f5132'
                        }}
                    >
                        Terdaftar ({registeredCount})
                    </button>
                    <button
                        onClick={() => setActiveTab('UNREGISTERED')}
                        style={{
                            padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '12px',
                            backgroundColor: activeTab === 'UNREGISTERED' ? '#dc3545' : '#f8d7da',
                            color: activeTab === 'UNREGISTERED' ? '#fff' : '#842029'
                        }}
                    >
                        Tidak Terdaftar ({unregisteredCount})
                    </button>
                </div>

                {/* Table Body */}
                <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                                <th style={{ padding: '8px', textAlign: 'center', width: '120px' }}>Status</th>
                                <th style={{ padding: '8px', width: '130px' }}>No PO</th>
                                <th style={{ padding: '8px' }}>Produk</th>
                                <th style={{ padding: '8px', width: '120px' }}>No Batch</th>
                                <th style={{ padding: '8px', textAlign: 'center', width: '100px' }}>Tgl Aktual</th>
                                <th style={{ padding: '8px', textAlign: 'right', width: '110px' }}>Qty (PCS)</th>
                                <th style={{ padding: '8px', width: '220px' }}>Keterangan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResults.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                                        Tidak ada data pada kategori ini.
                                    </td>
                                </tr>
                            ) : (
                                filteredResults.map((item, idx) => (
                                    <tr key={idx} style={{
                                        borderBottom: '1px solid #e9ecef',
                                        backgroundColor: item.status === 'TIDAK_TERDAFTAR' ? '#fff5f5' : 'inherit'
                                    }}>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            {renderStatusBadge(item.status)}
                                        </td>
                                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{item.poNumber}</td>
                                        <td style={{ padding: '8px' }}>
                                            {item.productName !== '-' ? `${item.productCode} - ${item.productName}` : item.productCode}
                                        </td>
                                        <td style={{ padding: '8px' }}>{item.batchNumber}</td>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.actDate || '-'}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatQty(item.fulfilledQty)}
                                        </td>
                                        <td style={{ padding: '8px', color: item.status === 'TIDAK_TERDAFTAR' ? '#dc3545' : '#6c757d', fontSize: '12px' }}>
                                            {item.notes}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
