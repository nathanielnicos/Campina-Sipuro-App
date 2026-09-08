import { useEffect, useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { fetchPODetail, fetchCompanyProfile } from '../../services/poApi';
import { formatCurrency, formatDate, formatQty } from '../../utils/formatters';

const POPdfModal = ({ poId, onClose }) => {
    const [poData, setPoData] = useState(null);
    const [seller, setSeller] = useState(null);
    const [loading, setLoading] = useState(true);
    const pdfContentRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                // Memanggil detail PO dan profile penjual secara bersamaan
                const [poRes, companyRes] = await Promise.all([
                    fetchPODetail(poId),
                    fetchCompanyProfile()
                ]);

                if (poRes.success) {
                    setPoData(poRes.data);
                }
                if (companyRes.success && companyRes.data) {
                    setSeller(companyRes.data);
                }
            } catch (err) {
                console.error('Failed to fetch PDF data:', err);
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

    const ppnPercentNum = poData?.header?.ppn_percent ? Number(poData.header.ppn_percent) : (seller?.ppn_percent ? Number(seller.ppn_percent) : 0);
    const header = poData?.header || {};

    // Helper untuk format tanggal & waktu pada bagian footer metadata
    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

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
                width: '850px',
                maxWidth: '92%',
                maxHeight: '88vh',
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
                    <h5 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>PO Document Preview</h5>
                    <button
                        onClick={onClose}
                        style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#6c757d' }}
                    >
                        &times;
                    </button>
                </div>

                {/* Body Modal (Scrollable) */}
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#f1f3f5' }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', padding: '20px' }}>Loading document...</p>
                    ) : poData ? (
                        <div
                            ref={pdfContentRef}
                            style={{
                                backgroundColor: '#ffffff',
                                padding: '40px',
                                borderRadius: '4px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                color: '#111',
                                fontFamily: 'Arial, sans-serif'
                            }}
                        >
                            {/* Document Header Section */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
                                {/* Left Side: Title & Seller Info (Company Profile) */}
                                <div style={{ width: '45%' }}>
                                    <h1 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                                        PURCHASE ORDER
                                    </h1>
                                    <div style={{ fontSize: '12px', lineHeight: '1.5', color: '#333' }}>
                                        <strong>{seller?.company_name || '-'}</strong>
                                        <div style={{ whiteSpace: 'pre-line', marginTop: '2px' }}>
                                            {seller?.address || '-'}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: PO Meta Info & Customer Info */}
                                <div style={{ width: '50%', display: 'flex', gap: '20px', fontSize: '12px', lineHeight: '1.4' }}>
                                    {/* PO Dates & Numbers */}
                                    <div style={{ width: '50%' }}>
                                        <div style={{ marginBottom: '8px' }}>
                                            <div style={{ fontWeight: 'bold' }}>Purchase Order Date</div>
                                            <div>{formatDate(header.created_at)}</div>
                                        </div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <div style={{ fontWeight: 'bold' }}>Delivery Date</div>
                                            <div>{formatDate(header.requested_delivery_date)}</div>
                                        </div>
                                        <div style={{ marginBottom: '8px' }}>
                                            <div style={{ fontWeight: 'bold' }}>Purchase Order Number</div>
                                            <div>{header.po_number}</div>
                                        </div>
                                    </div>

                                    {/* Customer Company Info (Pembeli) */}
                                    <div style={{ width: '50%' }}>
                                        <strong>{header.company_name || '-'}</strong>
                                        <div style={{ whiteSpace: 'pre-line', marginTop: '4px', color: '#333' }}>
                                            {header.address || '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Products Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #000' }}>
                                        <th style={{ padding: '8px 4px', textAlign: 'left' }}>Description</th>
                                        <th style={{ padding: '8px 4px', textAlign: 'right', width: '80px' }}>Quantity</th>
                                        <th style={{ padding: '8px 4px', textAlign: 'right', width: '100px' }}>Unit Price</th>
                                        <th style={{ padding: '8px 4px', textAlign: 'center', width: '60px' }}>Tax</th>
                                        <th style={{ padding: '8px 4px', textAlign: 'right', width: '120px' }}>Amount IDR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {poData.items.map((item, index) => {
                                        const unitPrice = item.qty > 0 ? item.total_price / item.qty : 0;
                                        return (
                                            <tr key={index} style={{ borderBottom: '1px solid #000' }}>
                                                <td style={{ padding: '10px 4px', fontWeight: 'bold' }}>{item.product_name}</td>
                                                <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatQty(item.qty)}</td>
                                                <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatCurrency(unitPrice).replace('Rp', '').trim()}</td>
                                                <td style={{ padding: '10px 4px', textAlign: 'center' }}>{ppnPercentNum}%</td>
                                                <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatCurrency(item.total_price).replace('Rp', '').trim()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Subtotal & Total Summary */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', marginBottom: '30px' }}>
                                <div style={{ width: '280px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 'bold' }}>
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(header.subtotal)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 'bold' }}>
                                        <span>TOTAL PPN TAX IN {ppnPercentNum}%</span>
                                        <span>{formatCurrency((header.subtotal * ppnPercentNum) / 100)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: 'bold', borderTop: '1px solid #000', borderBottom: '1px solid #000', marginTop: '4px' }}>
                                        <span>TOTAL IDR</span>
                                        <span>{formatCurrency(header.total_amount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Audit / Action Metadata */}
                            <div style={{ fontSize: '10px', color: '#666', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid #ddd', lineHeight: '1.5' }}>
                                <div><strong>Created by:</strong> {header.creator_name || '-'}</div>
                                <div><strong>Created at:</strong> {formatDateTime(header.created_at)}</div>
                            </div>

                            {/* Delivery Details Section */}
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 12px 0', letterSpacing: '0.5px' }}>
                                    DELIVERY DETAILS
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '11px', lineHeight: '1.5' }}>
                                    {/* Alamat Pengiriman */}
                                    <div>
                                        <strong style={{ display: 'block', marginBottom: '4px' }}>Delivery Address</strong>
                                        <div style={{ whiteSpace: 'pre-line', color: '#333' }}>
                                            {header.delivery_address || '-'}
                                        </div>
                                    </div>

                                    {/* Instruksi & Notes */}
                                    <div>
                                        <strong style={{ display: 'block', marginBottom: '4px' }}>Note</strong>
                                        <div style={{ whiteSpace: 'pre-line', color: '#333' }}>
                                            {header.description ? `${header.description}` : '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#dc3545', padding: '20px' }}>Failed to load PO data.</p>
                    )}
                </div>

                {/* Footer Modal Action Buttons */}
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
                        Close
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
                        Download PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default POPdfModal;
