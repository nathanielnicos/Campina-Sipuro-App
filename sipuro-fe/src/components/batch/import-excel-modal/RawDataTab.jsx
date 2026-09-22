import { useState } from 'react';
import { formatQty, formatDateTime } from '../../../utils/formatters';
import PaginationControl from '../../common/PaginationControl';

const RawDataTab = ({ rawData = [], emptyMessage = "No data available." }) => {
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
                            <th style={{ textAlign: 'left', width: '100px', padding: '8px' }}>Batch Number</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Lot Number</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Item Code</th>
                            <th style={{ textAlign: 'center', padding: '8px' }}>Lot Status</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Qty (Pcs)</th>
                            <th style={{ textAlign: 'center', padding: '8px' }}>Start Datetime</th>
                            <th style={{ textAlign: 'center', padding: '8px' }}>Completed Datetime</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row, idx) => {
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                                        <td style={{ fontWeight: 'bold', padding: '8px' }}>{row.batchNumber || '-'}</td>
                                        <td style={{ padding: '8px' }}>{row.lotNumber || '-'}</td>
                                        <td style={{ padding: '8px' }}>{row.itemCode || '-'}</td>
                                        <td style={{ textAlign: 'center', padding: '8px' }}>
                                            {row.lotStatus || '-'}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '8px' }}>{formatQty(row.qtyPac)}</td>
                                        <td style={{ textAlign: 'center', padding: '8px' }}>{formatDateTime(row.actualStartDatetime) || '-'}</td>
                                        <td style={{ textAlign: 'center', padding: '8px' }}>{formatDateTime(row.actualCompletedDatetime) || '-'}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            <PaginationControl
                pagination={{
                    currentPage,
                    totalPages,
                    totalItems,
                    limit: pageSize
                }}
                onPageChange={(p) => setCurrentPage(p)}
                onLimitChange={(l) => { setPageSize(l); setCurrentPage(1); }}
            />
        </div>
    );
};

export default RawDataTab;
