import React, { useState } from 'react';
import { formatDateTime } from '../../../utils/dateHelper';
import PaginationControl from '../../common/PaginationControl';
import QtyStack from '../../common/QtyStack';

/**
 * Baris valid yang akan disimpan: satu baris per (nomor, item, lot).
 * Dipakai untuk DO (numberLabel "DO Number") dan retur (numberLabel "Return Number").
 */
const ImportDoValidDataTab = ({ lines = [], numberLabel = 'DO Number', emptyMessage = 'No valid data available to save.' }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const totalItems = lines.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const pageLines = lines.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    if (totalItems === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '32px', color: '#6c757d', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                {emptyMessage}
            </div>
        );
    }

    const cell = { padding: '8px', verticalAlign: 'middle' };

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#fff' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ textAlign: 'left', padding: '8px', width: '130px' }}>{numberLabel}</th>
                            <th style={{ textAlign: 'left', padding: '8px', width: '150px' }}>Date and Time</th>
                            <th style={{ textAlign: 'left', padding: '8px', minWidth: '200px' }}>Item</th>
                            <th style={{ textAlign: 'left', padding: '8px', width: '110px' }}>Lot Number</th>
                            <th style={{ textAlign: 'right', padding: '8px', width: '110px' }}>Qty (Pcs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageLines.map((line) => (
                            <tr key={`${line.referenceNum}-${line.itemCode}-${line.lotNumber}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                                <td style={{ ...cell, fontWeight: 'bold' }}>{line.referenceNum}</td>
                                <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatDateTime(line.transDateTime)}</td>
                                <td style={cell}>
                                    <div style={{ fontWeight: 'bold' }}>{line.itemCode}</div>
                                    <div style={{ fontSize: '11px', color: '#6c757d' }}>{line.productName}</div>
                                </td>
                                <td style={{ ...cell, fontFamily: 'monospace', fontWeight: '500' }}>{line.lotNumber}</td>
                                <td style={cell}><QtyStack pcs={line.qtyPcs} ctn={line.qtyCtn} color="#198754" /></td>
                            </tr>
                        ))}
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

export default ImportDoValidDataTab;
