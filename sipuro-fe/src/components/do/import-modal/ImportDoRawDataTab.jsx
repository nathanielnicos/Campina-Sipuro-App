import React, { useState } from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDateTime } from '../../../utils/dateHelper';
import PaginationControl from '../../common/PaginationControl';

// Qty bertanda: baris dengan qty negatif ditampilkan dengan tanda minus agar alasan penolakan terlihat
const formatSignedQty = (value) => {
    const n = Number(value) || 0;
    return n < 0 ? `-${formatQty(Math.abs(n))}` : formatQty(n);
};

const ImportDoRawDataTab = ({ rawData = [], emptyMessage = 'No data available.', showReason = false }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = Array.isArray(rawData) ? rawData : [];
    const totalItems = rows.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#ffffff' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ textAlign: 'left', padding: '8px', width: '60px' }}>Excel Row</th>
                            <th style={{ textAlign: 'left', padding: '8px', width: '130px' }}>DO / Return Number</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Trans Type</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Item Code</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Lot Number</th>
                            <th style={{ textAlign: 'center', padding: '8px' }}>Status</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Qty (Pcs)</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Date and Time</th>
                            {showReason && <th style={{ textAlign: 'left', padding: '8px', minWidth: '220px' }}>Reason</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.length === 0 ? (
                            <tr>
                                <td colSpan={showReason ? 9 : 8} style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row) => (
                                <tr key={row.excelRowNumber} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    <td style={{ padding: '8px', color: '#6c757d' }}>{row.excelRowNumber}</td>
                                    <td style={{ fontWeight: 'bold', padding: '8px' }}>{row.referenceNum || '-'}</td>
                                    <td style={{ padding: '8px' }}>{row.transType || '-'}</td>
                                    <td style={{ padding: '8px' }}>{row.itemCode || '-'}</td>
                                    <td style={{ padding: '8px', fontFamily: 'monospace' }}>{row.lotNumber || '-'}</td>
                                    <td style={{ textAlign: 'center', padding: '8px' }}>{row.lotStatus || '-'}</td>
                                    <td style={{ textAlign: 'right', padding: '8px', fontWeight: '500' }}>{formatSignedQty(row.qty)}</td>
                                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{formatDateTime(row.transDateTime)}</td>
                                    {showReason && <td style={{ padding: '8px', color: '#842029' }}>{row.reason || '-'}</td>}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <PaginationControl
                pagination={{ currentPage, totalPages, totalItems, limit: pageSize }}
                onPageChange={(p) => setCurrentPage(p)}
                onLimitChange={(l) => { setPageSize(l); setCurrentPage(1); }}
            />
        </div>
    );
};

export default ImportDoRawDataTab;
