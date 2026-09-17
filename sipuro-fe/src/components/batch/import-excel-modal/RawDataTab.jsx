import React, { useState } from 'react';
import { formatQty, formatDateTime } from '../../../utils/formatters';
import PaginationControl from '../../common/PaginationControl';

const RawDataTab = ({ rows = [], config }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const totalItems = rows.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div style={{ border: `1px solid ${config.borderColor}`, borderRadius: '4px', backgroundColor: config.bgColor }}>
            <div style={{ padding: '8px 12px', fontSize: '12px', color: config.textColor }}>
                {config.infoMessage}
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: config.headerBg }}>
                            <th style={{ textAlign: 'left' }}>Batch Number</th>
                            <th style={{ textAlign: 'left' }}>Lot Number</th>
                            <th style={{ textAlign: 'left' }}>Item Code</th>
                            <th style={{ textAlign: 'center' }}>Lot Status</th>
                            <th style={{ textAlign: 'right' }}>Qty (Pcs)</th>
                            <th style={{ textAlign: 'center' }}>Start Datetime</th>
                            <th style={{ textAlign: 'center' }}>Completed Datetime</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                    {config.emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row, idx) => (
                                <tr key={idx}>
                                    <td style={{ fontWeight: 'bold' }}>{row.batchNumber}</td>
                                    <td>{row.lotNumber || '-'}</td>
                                    <td>{row.itemCode}</td>
                                    <td style={{
                                        textAlign: 'center',
                                        fontWeight: config.highlightStatus ? 'bold' : 'normal',
                                        color: config.highlightStatus ? '#dc3545' : 'inherit'
                                    }}>
                                        {row.lotStatus || '-'}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{formatQty(row.qtyPac)}</td>
                                    <td style={{ textAlign: 'center' }}>{formatDateTime(row.actualStartDatetime) || '-'}</td>
                                    <td style={{ textAlign: 'center' }}>{formatDateTime(row.actualCompletedDatetime) || '-'}</td>
                                </tr>
                            ))
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
