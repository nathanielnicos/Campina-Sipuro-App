import React, { useState } from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';
import PaginationControl from '../../common/PaginationControl';

const ImportSiRawDataTab = ({ rawData = [], emptyMessage = "No items found.", showReason = false }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const totalItems = rawData.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedRows = rawData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#fff' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ textAlign: 'left', padding: '8px', width: '130px' }}>SI Number</th>
                            <th style={{ textAlign: 'left', padding: '8px', width: '130px' }}>DO Number</th>
                            <th style={{ textAlign: 'left', padding: '8px', width: '100px' }}>Item Code</th>
                            <th style={{ textAlign: 'right', padding: '8px', width: '80px' }}>Qty (Ctn)</th>
                            <th style={{ textAlign: 'center', padding: '8px', width: '90px' }}>SI Date</th>
                            {showReason && <th style={{ textAlign: 'left', padding: '8px' }}>Reason</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.length === 0 ? (
                            <tr>
                                <td colSpan={showReason ? 6 : 5} style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{row.invoiceNumber || '-'}</td>
                                    <td style={{ padding: '8px' }}>{row.doNumber || '-'}</td>
                                    <td style={{ padding: '8px' }}>{row.itemCode || '-'}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatQty(row.qtyCtn)}</td>
                                    <td style={{ padding: '8px', textAlign: 'center' }}>{formatDate(row.siDate) || '-'}</td>
                                    {showReason && <td style={{ padding: '8px', color: '#842029' }}>{row.reason || '-'}</td>}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <PaginationControl
                pagination={{ currentPage, totalPages, totalItems, limit: pageSize }}
                onPageChange={setCurrentPage}
                onLimitChange={(l) => { setPageSize(l); setCurrentPage(1); }}
            />
        </div>
    );
};

export default ImportSiRawDataTab;
