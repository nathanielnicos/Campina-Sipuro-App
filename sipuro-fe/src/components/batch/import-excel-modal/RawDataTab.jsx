import React, { useState } from 'react';
import { formatQty, formatDateTime } from '../../../utils/formatters';
import PaginationControl from '../../common/PaginationControl';

const RawDataTab = ({ rawData = [], emptyMessage = "No data available.", isUnallocatedMode = false }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = Array.isArray(rawData) ? rawData : [];
    const totalItems = rows.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Helper merender Start & Complete Datetime 2 baris
    const renderActualDates = (start, complete) => {
        const startFormatted = start ? formatDateTime(start) : null;
        const completeFormatted = complete ? formatDateTime(complete) : null;

        if (startFormatted && completeFormatted) {
            return (
                <div style={{ lineHeight: '1.3', fontSize: '11px' }}>
                    <div>{startFormatted}</div>
                    <div style={{ color: '#6c757d' }}>s/d {completeFormatted}</div>
                </div>
            );
        }

        if (startFormatted) return <span style={{ fontSize: '11px' }}>{startFormatted}</span>;
        if (completeFormatted) return <span style={{ fontSize: '11px' }}>{completeFormatted}</span>;

        return '-';
    };

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#ffffff' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ textAlign: 'left', width: '100px', padding: '8px' }}>Batch Number</th>
                            {isUnallocatedMode ? (
                                <>
                                    <th style={{ textAlign: 'left', minWidth: '200px', padding: '8px' }}>Product</th>
                                    <th style={{ textAlign: 'right', width: '140px', padding: '8px' }}>Unallocated Qty (Pcs)</th>
                                    <th style={{ textAlign: 'center', width: '135px', padding: '8px' }}>Actual Date</th>
                                </>
                            ) : (
                                <>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Lot Number</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Item Code</th>
                                    <th style={{ textAlign: 'center', padding: '8px' }}>Lot Status</th>
                                    <th style={{ textAlign: 'right', padding: '8px' }}>Qty (Pcs)</th>
                                    <th style={{ textAlign: 'center', padding: '8px' }}>Start Datetime</th>
                                    <th style={{ textAlign: 'center', padding: '8px' }}>Completed Datetime</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.length === 0 ? (
                            <tr>
                                <td colSpan={isUnallocatedMode ? 4 : 7} style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row, idx) => {
                                if (isUnallocatedMode) {
                                    const prodCode = row.productCode || row.itemCode || '';
                                    const prodName = row.productName || '';
                                    const productTitle = prodCode ? `${prodCode}${prodName ? ' - ' + prodName : ''}` : '-';

                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                                            <td style={{ fontWeight: 'bold', verticalAlign: 'top', padding: '8px' }}>{row.batchNumber || '-'}</td>
                                            <td style={{ verticalAlign: 'top', padding: '8px', wordBreak: 'break-word' }}>{productTitle}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#0d6efd', padding: '8px', verticalAlign: 'top' }}>
                                                {formatQty(row.qtyAvailable || row.qtyPac || 0)}
                                            </td>
                                            <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '8px' }}>
                                                {renderActualDates(row.actualStartDatetime, row.actualCompletedDatetime)}
                                            </td>
                                        </tr>
                                    );
                                }

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
