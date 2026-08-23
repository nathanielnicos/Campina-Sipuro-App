import React from 'react';

const formatQty = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return Number(value).toLocaleString('id-ID');
};

const PendingSkuTable = ({ summaryList, onOpenModal }) => {
    return (
        <table border="1" cellPadding="10" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                    <th>Kode SKU</th>
                    <th>Nama Produk</th>
                    <th>Satuan (UOM)</th>
                    <th style={{ textAlign: 'right' }}>Total Qty Dibutuhkan</th>
                    <th style={{ textAlign: 'center' }}>Jumlah PO</th>
                    <th>Rincian PO & Qty</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
            </thead>
            <tbody>
                {summaryList.length === 0 ? (
                    <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                            Tidak ada kebutuhan SKU yang perlu dialokasikan saat ini.
                        </td>
                    </tr>
                ) : (
                    summaryList.map((row) => (
                        <tr key={row.id_product}>
                            <td><strong>{row.product_code}</strong></td>
                            <td>{row.product_name}</td>
                            <td>{row.base_uom}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatQty(row.total_qty_needed)}</td>
                            <td style={{ textAlign: 'center' }}>{row.total_po_count} PO</td>
                            <td style={{ fontSize: '13px', color: '#333', whiteSpace: 'pre-line', lineHeight: '1.5' }}>{row.po_numbers}</td>
                            <td style={{ textAlign: 'center' }}>
                                <button
                                    onClick={() => onOpenModal(row)}
                                    style={{ backgroundColor: '#0d6efd', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                                >
                                    + Alokasikan Batch
                                </button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
};

export default PendingSkuTable;
