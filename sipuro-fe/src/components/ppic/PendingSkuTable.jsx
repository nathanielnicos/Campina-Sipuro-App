import React from 'react';
import PaginationControl from '../common/PaginationControl';

const formatQty = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return Number(value).toLocaleString('id-ID');
};

const PendingSkuTable = ({
    summaryList = [],
    onOpenModal,
    pagination = {},
    onPageChange,
    onLimitChange
}) => {
    return (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                            <th style={{ padding: '12px 16px' }}>Kode SKU</th>
                            <th style={{ padding: '12px 16px' }}>Nama Produk</th>
                            <th style={{ padding: '12px 16px' }}>Satuan (UOM)</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Qty Dibutuhkan</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Jumlah PO</th>
                            <th style={{ padding: '12px 16px' }}>Rincian PO & Qty</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center' }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summaryList.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                    Tidak ada kebutuhan SKU yang perlu dialokasikan saat ini.
                                </td>
                            </tr>
                        ) : (
                            summaryList.map((row) => (
                                <tr key={row.id_product} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    <td style={{ padding: '12px 16px' }}><strong>{row.product_code}</strong></td>
                                    <td style={{ padding: '12px 16px' }}>{row.product_name}</td>
                                    <td style={{ padding: '12px 16px' }}>{row.base_uom}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold' }}>{formatQty(row.total_qty_needed)}</td>

                                    {/* Perubahan di sini: Hanya menampilkan angka */}
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>{row.total_po_count}</td>

                                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#333', whiteSpace: 'pre-line', lineHeight: '1.5' }}>{row.po_numbers}</td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
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
            </div>

            {/* Reusable Pagination Component */}
            <PaginationControl
                pagination={pagination}
                onPageChange={onPageChange}
                onLimitChange={onLimitChange}
            />
        </div>
    );
};

export default PendingSkuTable;
