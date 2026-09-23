import { forwardRef } from 'react';
import { formatCurrency, formatDate, formatQty } from '../../../utils/formatters';

const PdfDocument = forwardRef(({ poData, seller, ppnPercentNum }, ref) => {
    const header = poData?.header || {};

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
        <div
            ref={ref}
            style={{
                backgroundColor: '#ffffff',
                padding: '40px',
                borderRadius: '4px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                color: '#111',
                fontFamily: 'Arial, sans-serif'
            }}
        >
            {/* Header Dokumen */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
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

                <div style={{ width: '50%', display: 'flex', gap: '20px', fontSize: '12px', lineHeight: '1.4' }}>
                    <div style={{ width: '50%' }}>
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontWeight: 'bold' }}>Purchase Order Date</div>
                            <div>{formatDate(header.created_at)}</div>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontWeight: 'bold' }}>Purchase Order Number</div>
                            <div>{header.po_number}</div>
                        </div>
                    </div>

                    <div style={{ width: '50%' }}>
                        <strong>{header.company_name || '-'}</strong>
                        <div style={{ whiteSpace: 'pre-line', marginTop: '4px', color: '#333' }}>
                            {header.address || '-'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabel Produk */}
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
                    {poData?.items?.map((item, index) => {
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

            {/* Metadata Dokumen */}
            <div style={{ fontSize: '10px', color: '#666', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid #ddd', lineHeight: '1.5' }}>
                {/* 1. Informasi Pembuat / Pemrakarsa */}
                <div>
                    <strong>Created by:</strong> {header.creator_name || 'System'}
                </div>

                {/* 2. Informasi Customer yang Mengirim / Mempublikasikan (jika berasal dari sistem) */}
                {!header.creator_name && header.updater_name && (
                    <div>
                        <strong>Submitted by:</strong> {header.updater_name}
                    </div>
                )}

                {/* 3. Waktu Pembuatan Dokumen */}
                <div>
                    <strong>Created at:</strong> {formatDateTime(header.created_at)}
                </div>
            </div>

            {/* Info Pengiriman */}
            <div>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 12px 0', letterSpacing: '0.5px' }}>
                    DELIVERY DETAILS
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '11px', lineHeight: '1.5' }}>
                    <div>
                        <strong style={{ display: 'block', marginBottom: '4px' }}>Delivery Address</strong>
                        <div style={{ whiteSpace: 'pre-line', color: '#333' }}>
                            {header.delivery_address || '-'}
                        </div>
                    </div>
                    <div>
                        <strong style={{ display: 'block', marginBottom: '4px' }}>Note</strong>
                        <div style={{ whiteSpace: 'pre-line', color: '#333' }}>
                            {header.description ? `${header.description}` : '-'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

PdfDocument.displayName = 'PdfDocument';

export default PdfDocument;
