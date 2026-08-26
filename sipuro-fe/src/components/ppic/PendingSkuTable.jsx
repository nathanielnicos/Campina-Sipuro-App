import React from 'react';
import { formatQty } from '../../utils/formatters';
import PaginationControl from '../common/PaginationControl';

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
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                            <th style={{ padding: '12px 10px', width: '13%', whiteSpace: 'nowrap' }}>Kode Produk</th>
                            <th style={{ padding: '12px 10px', width: '33%' }}>Nama Produk</th>
                            <th style={{ padding: '12px 10px', width: '13%', textAlign: 'right', whiteSpace: 'nowrap' }}>Total Qty Dibutuhkan</th>
                            <th style={{ padding: '12px 10px', width: '9%', textAlign: 'center', whiteSpace: 'nowrap' }}>Jumlah PO</th>
                            <th style={{ padding: '12px 10px', width: '13%', whiteSpace: 'nowrap' }}>No PO</th>
                            <th style={{ padding: '12px 10px', width: '6%', textAlign: 'right', whiteSpace: 'nowrap' }}>Qty PO</th>
                            <th style={{ padding: '12px 10px', width: '13%', textAlign: 'center', whiteSpace: 'nowrap' }}>Aksi</th>
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
                            summaryList.map((row) => {
                                const poItems = row.po_numbers
                                    ? row.po_numbers.split('\n').filter(Boolean)
                                    : [];

                                return (
                                    <tr key={row.id_product} style={{ borderBottom: '1px solid #dee2e6' }}>
                                        <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                            <strong>{row.product_code}</strong>
                                        </td>
                                        <td style={{ padding: '12px 10px', verticalAlign: 'middle', wordBreak: 'break-word' }}>
                                            {row.product_name}
                                        </td>
                                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                                            {formatQty(row.total_qty_needed)}
                                        </td>
                                        <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            {formatQty(row.total_po_count)}
                                        </td>

                                        {/* Kolom No PO */}
                                        <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                                            {poItems.length > 0 ? (
                                                poItems.map((item, idx) => {
                                                    const poNumber = item.split(' (')[0];
                                                    return <div key={idx} style={{ fontWeight: '500' }}>{poNumber}</div>;
                                                })
                                            ) : (
                                                '-'
                                            )}
                                        </td>

                                        {/* Kolom Qty PO */}
                                        <td style={{ padding: '12px 10px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                                            {poItems.length > 0 ? (
                                                poItems.map((item, idx) => {
                                                    const match = item.match(/\((.*?)\)/);
                                                    const rawQty = match ? match[1].replace(/\D/g, '') : '';
                                                    const formattedQty = rawQty ? formatQty(rawQty) : '-';

                                                    return (
                                                        <div key={idx}>
                                                            {formattedQty}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                '-'
                                            )}
                                        </td>

                                        {/* Kolom Aksi */}
                                        <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                            <button
                                                onClick={() => onOpenModal(row)}
                                                style={{
                                                    backgroundColor: '#0d6efd',
                                                    color: '#fff',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontWeight: '600',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                + Alokasikan Batch
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
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
