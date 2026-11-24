import { useState } from 'react';
import { formatQty } from '../../../utils/formatters';
import PaginationControl from '../../common/PaginationControl';

// Daftar alokasi lot baru ke PO lama yang pernah terlompati (PO lebih baru sudah terisi). Hanya informasi.
const SkippedPoTab = ({ rows = [], emptyMessage = 'No skipped PO found.' }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const list = Array.isArray(rows) ? rows : [];
    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const page = Math.min(currentPage, totalPages);
    const paginated = list.slice((page - 1) * pageSize, page * pageSize);

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#ffffff' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ textAlign: 'center', width: '70px', padding: '8px', whiteSpace: 'nowrap' }}>Excel Row</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Batch</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Lot Number</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Item Code</th>
                            <th style={{ textAlign: 'left', padding: '8px', whiteSpace: 'nowrap' }}>Older PO (skipped)</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>PO Remaining (Pcs)</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Qty Allocated (Pcs)</th>
                            <th style={{ textAlign: 'left', padding: '8px', whiteSpace: 'nowrap' }}>Newer PO Already Filled</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Newer PO Fulfilled (Pcs)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginated.map((row, idx) => (
                                <tr key={`${row.excelRowNumber}-${row.poDetailId}-${idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    <td style={{ textAlign: 'center', padding: '8px', color: '#6c757d', whiteSpace: 'nowrap' }}>
                                        {row.excelRowNumber || '-'}
                                        {Number(row.rowCount) > 1 ? ` (+${Number(row.rowCount) - 1})` : ''}
                                    </td>
                                    <td style={{ fontWeight: 'bold', padding: '8px' }}>{row.batchNumber || '-'}</td>
                                    <td style={{ padding: '8px' }}>{row.lotNumber || '-'}</td>
                                    <td style={{ padding: '8px' }}>{row.itemCode || '-'}</td>
                                    <td style={{ padding: '8px', fontWeight: 'bold', whiteSpace: 'nowrap', color: '#842029' }}>{row.poNumber || '-'}</td>
                                    <td style={{ textAlign: 'right', padding: '8px' }}>{formatQty(Number(row.poRemainingBefore) || 0)}</td>
                                    <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold', color: '#198754' }}>{formatQty(Number(row.addedQty) || 0)}</td>
                                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{row.newerPoNumber || '-'}</td>
                                    <td style={{ textAlign: 'right', padding: '8px', color: '#6c757d' }}>{formatQty(Number(row.newerPoFulfilledQty) || 0)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <PaginationControl
                pagination={{
                    currentPage: page,
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

export default SkippedPoTab;
