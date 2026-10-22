import React, { useState } from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';
import PaginationControl from '../../common/PaginationControl';

const ImportDoRawDataTab = ({ rawData = [], emptyMessage = "No data available.", showReason = false }) => {
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
                            <th style={{ textAlign: 'left', padding: '8px', width: '130px' }}>DO / Shipment No</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Trans Type</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Item Code</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Lot Number</th>
                            <th style={{ textAlign: 'center', padding: '8px' }}>Status</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Qty</th>
                            <th style={{ textAlign: 'center', padding: '8px' }}>Date</th>
                            {showReason && <th style={{ textAlign: 'left', padding: '8px', minWidth: '180px' }}>Reason</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.length === 0 ? (
                            <tr>
                                <td colSpan={showReason ? 8 : 7} style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    <td style={{ fontWeight: 'bold', padding: '8px' }}>{row.shipmentNum || '-'}</td>
                                    <td style={{ padding: '8px' }}>{row.transType || '-'}</td>
                                    <td style={{ padding: '8px' }}>{row.itemCode || '-'}</td>
                                    <td style={{ padding: '8px', fontFamily: 'monospace' }}>{row.lotNumber || '-'}</td>
                                    <td style={{ textAlign: 'center', padding: '8px' }}>{row.lotStatus || '-'}</td>
                                    <td style={{ textAlign: 'right', padding: '8px', fontWeight: '500' }}>
                                        {formatQty(Math.abs(row.qtyToProcess || row.qtyOut || row.qtyIn || 0))}
                                    </td>
                                    <td style={{ textAlign: 'center', padding: '8px' }}>{formatDate(row.transDate) || '-'}</td>
                                    {showReason && <td style={{ padding: '8px', color: '#842029' }}>{row.reason || '-'}</td>}
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

export default ImportDoRawDataTab;
