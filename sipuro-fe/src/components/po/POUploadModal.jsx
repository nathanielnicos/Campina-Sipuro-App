import React, { useState } from 'react';
import { previewProductionApi, confirmProductionApi } from '../../services/ppicApi';

const POUploadModal = ({ isOpen, onClose, onSuccess, currentUser }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setErrorMsg('');
        }
    };

    const handleUploadPreview = async (e) => {
        e.preventDefault();
        if (!file) return setErrorMsg('Silakan pilih file Excel terlebih dahulu.');

        setLoading(true);
        setErrorMsg('');

        const formData = new FormData();
        formData.append('file', file);

        const res = await previewProductionApi(formData);
        setLoading(false);

        if (res && res.success) {
            setPreviewData(res.data);
        } else {
            setErrorMsg(res?.message || 'Gagal memproses file Excel.');
        }
    };

    const handleQtyChange = (index, newQty) => {
        const updated = [...previewData.previewResults];
        const parsedQty = parseInt(newQty, 10) || 0;

        updated[index].fulfilledQty = parsedQty;
        updated[index].rowStatus = parsedQty >= updated[index].allocatedQty * 0.9 ? 'Close' : 'Open';

        setPreviewData({ ...previewData, previewResults: updated });
    };

    const handleCommit = async () => {
        setLoading(true);
        setErrorMsg('');

        const payload = {
            processTimestamp: previewData.processTimestamp,
            fileName: previewData.fileName,
            userId: currentUser?.id || 1,
            allocations: previewData.previewResults,
            unallocatedStocks: previewData.unallocatedStocks
        };

        const res = await confirmProductionApi(payload);
        setLoading(false);

        if (res && res.success) {
            alert('Data alokasi produksi berhasil disimpan!');
            onSuccess();
            handleClose();
        } else {
            setErrorMsg(res?.message || 'Gagal menyimpan data alokasi.');
        }
    };

    const handleClose = () => {
        setFile(null);
        setPreviewData(null);
        setErrorMsg('');
        onClose();
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '90%', maxWidth: '1100px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>Upload Data Hasil Produksi (Excel)</h3>
                    <button onClick={handleClose} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
                </div>

                {errorMsg && (
                    <div style={{ padding: '12px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '16px' }}>
                        {errorMsg}
                    </div>
                )}

                {!previewData ? (
                    <form onSubmit={handleUploadPreview}>
                        <div style={{ border: '2px dashed #ccc', padding: '32px', textAlign: 'center', borderRadius: '8px', marginBottom: '16px' }}>
                            <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} style={{ marginBottom: '12px' }} />
                            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>Upload file laporan produksi Excel dari sistem (RORCMAN02)</p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button type="button" onClick={handleClose} style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}>
                                Batal
                            </button>
                            <button type="submit" disabled={loading || !file} style={{ padding: '8px 16px', borderRadius: '4px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                {loading ? 'Memproses...' : 'Upload & Preview'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div>
                        {/* WARNING RE-UPLOAD BANNER */}
                        {previewData.isReupload && (
                            <div style={{ padding: '12px', backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', borderRadius: '4px', marginBottom: '16px', fontSize: '13px' }}>
                                ⚠️ <strong>Peringatan Re-upload:</strong> {previewData.warningMessage}
                            </div>
                        )}

                        <div style={{ backgroundColor: '#e9ecef', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '14px' }}>
                            <strong>File:</strong> {previewData.fileName} | <strong>Timestamp Header:</strong> {previewData.processTimestamp}
                        </div>

                        <h4 style={{ marginBottom: '8px' }}>Preview Alokasi FIFO PO</h4>
                        <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f1f3f5', textAlign: 'left' }}>
                                        <th style={{ padding: '8px', border: '1px solid #dee2e6' }}>No PO</th>
                                        <th style={{ padding: '8px', border: '1px solid #dee2e6' }}>SKU / Product</th>
                                        <th style={{ padding: '8px', border: '1px solid #dee2e6' }}>Batch Num</th>
                                        <th style={{ padding: '8px', border: '1px solid #dee2e6' }}>Plan Date</th>
                                        <th style={{ padding: '8px', border: '1px solid #dee2e6' }}>Act Date (Excel)</th>
                                        <th style={{ padding: '8px', border: '1px solid #dee2e6' }}>Target Qty</th>
                                        <th style={{ padding: '8px', border: '1px solid #dee2e6', width: '120px' }}>Fulfilled Qty (Override)</th>
                                        <th style={{ padding: '8px', border: '1px solid #dee2e6' }}>Status Row</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.previewResults.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                                Tidak ada baris alokasi baru yang perlu diproses.
                                            </td>
                                        </tr>
                                    ) : (
                                        previewData.previewResults.map((item, idx) => (
                                            <tr key={idx}>
                                                <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{item.poNumber}</td>
                                                <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{item.productCode} - {item.productName}</td>
                                                <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{item.batchNumber}</td>
                                                <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{item.planDate}</td>
                                                <td style={{ padding: '8px', border: '1px solid #dee2e6', color: item.planDate !== item.actDate ? '#d9534f' : 'inherit' }}>
                                                    {item.actDate || '-'}
                                                </td>
                                                <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>{item.allocatedQty}</td>
                                                <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                                                    <input
                                                        type="number"
                                                        value={item.fulfilledQty}
                                                        onChange={(e) => handleQtyChange(idx, e.target.value)}
                                                        style={{ width: '100%', padding: '4px', boxSizing: 'border-box' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px', border: '1px solid #dee2e6' }}>
                                                    <span style={{
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        backgroundColor: item.rowStatus === 'Close' ? '#d4edda' : '#fff3cd',
                                                        color: item.rowStatus === 'Close' ? '#155724' : '#856404'
                                                    }}>
                                                        {item.rowStatus}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {previewData.unallocatedStocks && previewData.unallocatedStocks.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ marginBottom: '8px', color: '#856404' }}>Unallocated Stocks / Excess Stock</h4>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', backgroundColor: '#fff3cd' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '8px', border: '1px solid #ffeeba' }}>Batch Num</th>
                                            <th style={{ padding: '8px', border: '1px solid #ffeeba' }}>Kode Barang</th>
                                            <th style={{ padding: '8px', border: '1px solid #ffeeba' }}>Sisa Qty Available</th>
                                            <th style={{ padding: '8px', border: '1px solid #ffeeba' }}>Status Batch</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.unallocatedStocks.map((stk, sIdx) => (
                                            <tr key={sIdx}>
                                                <td style={{ padding: '8px', border: '1px solid #ffeeba' }}>{stk.batchNumber}</td>
                                                <td style={{ padding: '8px', border: '1px solid #ffeeba' }}>{stk.itemCode || stk.idProduct}</td>
                                                <td style={{ padding: '8px', border: '1px solid #ffeeba' }}>{stk.qtyAvailable}</td>
                                                <td style={{ padding: '8px', border: '1px solid #ffeeba' }}>
                                                    {stk.isNewUnregisteredBatch ? 'Batch Baru (Unregistered)' : 'Kelebihan Stock PO'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={() => setPreviewData(null)}
                                disabled={loading}
                                style={{ padding: '8px 16px', borderRadius: '4px', backgroundColor: '#dc3545', color: '#fff', border: 'none', cursor: 'pointer' }}
                            >
                                Tolak / Reset
                            </button>
                            <button
                                type="button"
                                onClick={handleCommit}
                                disabled={loading}
                                style={{ padding: '8px 16px', borderRadius: '4px', backgroundColor: '#198754', color: '#fff', border: 'none', cursor: 'pointer' }}
                            >
                                {loading ? 'Menyimpan...' : 'Terima & Simpan Data'}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default POUploadModal;
