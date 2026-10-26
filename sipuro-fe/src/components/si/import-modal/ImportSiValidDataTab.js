import React, { useState } from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';
import PaginationControl from '../../common/PaginationControl';

const ImportSiValidDataTab = ({ validRows = [] }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const totalItems = validRows.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedRows = validRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    if (totalItems === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '32px', color: '#6c757d', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                No valid Sales Invoice data to save.
            </div>
        );
    }

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#fff' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ textAlign: 'left', padding: '8px', width: '130px' }}>SI Number</th>
                            <th style={{ textAlign: 'center', padding: '8px', width: '100px' }}>SI Date</th>
                            <th style={{ textAlign: 'left', padding: '8px', width: '130px' }}>Matched DO No</th>
                            <th style={{ textAlign: 'left', padding: '8px', minWidth: '200px' }}>Product</th>
                            <th style={{ textAlign: 'right', padding: '8px', width: '90px' }}>Qty (Ctn)</th>
                            <th style={{ textAlign: 'right', padding: '8px', width: '90px' }}>Qty (Pcs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                                <td style={{ padding: '8px', fontWeight: 'bold' }}>{row.invoiceNumber}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{formatDate(row.siDate)}</td>
                                <td style={{ padding: '8px', fontWeight: '500', color: '#0d6efd' }}>{row.doNumber}</td>
                                <td style={{ padding: '8px' }}>
                                    <div style={{ fontWeight: 'bold' }}>{row.productCode}</div>
                                    <div style={{ fontSize: '11px', color: '#6c757d' }}>{row.productName}</div>
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatQty(row.qtyCtn)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', color: '#198754', fontWeight: 'bold' }}>{formatQty(row.qtyPcs)}</td>
                            </tr>
                        ))}
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

export default ImportSiValidDataTab;
