import React, { useEffect, useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { fetchPODetail } from '../../services/poApi';
import { formatCurrency, formatDate, formatQty } from '../../utils/formatters';

const POPdfModal = ({ poId, onClose }) => {
    const [poData, setPoData] = useState(null);
    const [loading, setLoading] = useState(true);
    const pdfContentRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await fetchPODetail(poId);
                if (res.success) {
                    setPoData(res.data);
                }
            } catch (err) {
                console.error('Gagal mengambil data PDF:', err);
            } finally {
                setLoading(false);
            }
        };
        if (poId) loadData();
    }, [poId]);

    const handleDownloadPdf = () => {
        const element = pdfContentRef.current;
        const options = {
            margin: 10,
            filename: `PO_${poData?.header?.po_number || 'Document'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(options).from(element).save();
    };

    if (!poId) return null;

    // Parsing PPN percent ke number untuk menghilangkan angka desimal nol otomatis
    const ppnPercentNum = poData?.header?.ppn_percent ? Number(poData.header.ppn_percent) : 0;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
        }}>
            {/* Modal Box */}
            <div style={{
                backgroundColor: '#ffffff',
                width: '800px',
                maxWidth: '92%',
                maxHeight: '85vh',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                overflow: 'hidden'
            }}>
                {/* Header Modal */}
                <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa'
                }}>
                    <h5 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Preview Dokumen PO</h5>
                    <button
                        onClick={onClose}
                        style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#6c757d' }}
                    >
                        &times;
                    </button>
                </div>

                {/* Body Modal (Dapat Di-scroll) */}
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#f1f3f5' }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', padding: '20px' }}>Memuat dokumen...</p>
                    ) : poData ? (
                        <div
                            ref={pdfContentRef}
                            style={{
                                backgroundColor: '#ffffff',
                                padding: '30px',
                                borderRadius: '4px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                color: '#333'
                            }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>PURCHASE ORDER</h2>
                                <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>{poData.header.po_number}</p>
                            </div>

                            {/* Info Header PO */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.2fr 0.8fr',
                                gap: '24px',
                                marginBottom: '24px',
                                fontSize: '13px',
                                lineHeight: '1.5'
                            }}>
                                <div>
                                    <p style={{ margin: '3px 0' }}><strong>Customer:</strong> {poData.header.company_name || '-'}</p>
                                    <p style={{ margin: '3px 0' }}><strong>Alamat Pengiriman:</strong> {poData.header.delivery_address || '-'}</p>
                                    <p style={{ margin: '3px 0' }}><strong>Catatan:</strong> {poData.header.description || '-'}</p>
                                </div>
                                <div>
                                    <p style={{ margin: '3px 0' }}><strong>Tanggal Buat:</strong> {formatDate(poData.header.created_at)}</p>
                                    <p style={{ margin: '3px 0' }}><strong>Tanggal Kirim:</strong> {formatDate(poData.header.requested_delivery_date)}</p>
                                    <p style={{ margin: '3px 0' }}><strong>Status:</strong> {poData.header.status}</p>
                                </div>
                            </div>

                            {/* Tabel Produk */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#e9ecef', borderBottom: '2px solid #dee2e6' }}>
                                        <th style={{ padding: '8px', textAlign: 'left', width: '35px' }}>No</th>
                                        <th style={{ padding: '8px', textAlign: 'left' }}>Produk</th>
                                        <th style={{ padding: '8px', textAlign: 'right', width: '75px' }}>Qty</th>
                                        <th style={{ padding: '8px', textAlign: 'center', width: '60px' }}>Satuan</th>
                                        <th style={{ padding: '8px', textAlign: 'right', width: '110px' }}>Harga Satuan</th>
                                        <th style={{ padding: '8px', textAlign: 'right', width: '110px' }}>Total Harga</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {poData.items.map((item, index) => {
                                        const unitPrice = item.qty > 0 ? item.total_price / item.qty : 0;

                                        return (
                                            <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                                                <td style={{ padding: '8px' }}>{index + 1}</td>
                                                <td style={{ padding: '8px' }}>{item.product_name}</td>
                                                <td style={{ padding: '8px', textAlign: 'right' }}>{formatQty(item.qty)}</td>
                                                <td style={{ padding: '8px', textAlign: 'center' }}>{item.uom}</td>
                                                <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(unitPrice)}</td>
                                                <td style={{ padding: '8px', textAlign: 'right' }}>{formatCurrency(item.total_price)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Ringkasan Total */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '13px' }}>
                                <div style={{ width: '250px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                                        <span>Subtotal:</span>
                                        <span>{formatCurrency(poData.header.subtotal)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                                        <span>PPN ({ppnPercentNum}%):</span>
                                        <span>{formatCurrency((poData.header.subtotal * ppnPercentNum) / 100)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: 'bold', borderTop: '1px solid #333', marginTop: '4px' }}>
                                        <span>Total Amount:</span>
                                        <span>{formatCurrency(poData.header.total_amount)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#dc3545', padding: '20px' }}>Gagal memuat data PO.</p>
                    )}
                </div>

                {/* Footer Modal */}
                <div style={{
                    padding: '12px 20px',
                    borderTop: '1px solid #dee2e6',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    backgroundColor: '#f8f9fa'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '4px',
                            border: '1px solid #6c757d',
                            backgroundColor: '#ffffff',
                            color: '#6c757d',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        Tutup
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        disabled={loading || !poData}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: '#dc3545',
                            color: '#ffffff',
                            fontWeight: 'bold',
                            cursor: loading || !poData ? 'not-allowed' : 'pointer',
                            opacity: loading || !poData ? 0.6 : 1,
                            fontSize: '13px'
                        }}
                    >
                        Unduh PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default POPdfModal;
