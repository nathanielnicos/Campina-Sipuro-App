import React from 'react';

const ProductionPreviewModal = ({
    isOpen,
    previewData,
    saving,
    onFulfilledChange,
    onConfirmSave,
    onRejectPreview
}) => {
    if (!isOpen || !previewData) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff', padding: '24px', borderRadius: '8px',
                width: '900px', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <h3 style={{ marginTop: 0 }}>Preview Hasil Produksi (Belum Disimpan)</h3>

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

                {/* Tabel Realisasi PO */}
                <table border="1" cellPadding="6" cellSpacing="0" style={{
                    width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px'
                }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5' }}>
                            <th>No PO</th>
                            <th>SKU / Produk</th>
                            <th>No Batch</th>
                            <th style={{ textAlign: 'center', width: '100px' }}>Tgl Rencana</th>
                            <th style={{ textAlign: 'center', width: '100px' }}>Tgl Aktual</th>
                            <th style={{ textAlign: 'right' }}>Target Qty</th>
                            <th style={{ textAlign: 'center', width: '110px' }}>Qty Terpenuhi</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {previewData.previewResults.map((item, idx) => {
                            const formattedPlanDate = item.planDate ? item.planDate.split('T')[0] : '-';
                            const formattedActDate = item.actDate ? item.actDate.split('T')[0] : '-';

                            return (
                                <tr key={idx}>
                                    <td><strong>{item.poNumber}</strong></td>
                                    <td>{item.productCode} - {item.productName}</td>
                                    <td>{item.batchNumber}</td>
                                    <td style={{ textAlign: 'center', width: '100px' }}>{formattedPlanDate}</td>
                                    <td style={{
                                        textAlign: 'center', width: '100px',
                                        color: formattedPlanDate !== formattedActDate ? '#d9534f' : 'inherit'
                                    }}>
                                        {formattedActDate}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{item.allocatedQty}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="number"
                                            value={item.fulfilledQty}
                                            onChange={(e) => onFulfilledChange(idx, e.target.value)}
                                            style={{ width: '70px', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}
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
                        })}
                    </tbody>
                </table>

                {/* Tabel Kelebihan Stok Produksi */}
                {previewData.unallocatedStocks && previewData.unallocatedStocks.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ marginBottom: '8px', color: '#856404' }}>Kelebihan Stok Produksi</h4>
                        <table border="1" cellPadding="6" cellSpacing="0" style={{
                            width: '100%', borderCollapse: 'collapse', fontSize: '13px', backgroundColor: '#fff3cd'
                        }}>
                            <thead>
                                <tr>
                                    <th>SKU / Produk</th>
                                    <th>No Batch</th>
                                    <th style={{ textAlign: 'right' }}>Sisa Qty Tersedia</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.unallocatedStocks.map((stk, sIdx) => {
                                    const productDisplay = stk.productCode
                                        ? `${stk.productCode} - ${stk.productName}`
                                        : (stk.productName || stk.itemCode || 'Produk Tidak Dikenal');

                                    return (
                                        <tr key={sIdx}>
                                            <td>{productDisplay}</td>
                                            <td>{stk.batchNumber}</td>
                                            <td style={{ textAlign: 'right' }}>{stk.qtyAvailable}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tombol Aksi */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
