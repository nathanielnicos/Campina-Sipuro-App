import { useState } from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDateTime } from '../../../utils/dateHelper';
import PaginationControl from '../../common/PaginationControl';

const RawDataTab = ({ rawData = [], emptyMessage = "No data available.", showReason = false, showChange = false }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const rows = Array.isArray(rawData) ? rawData : [];
    // Kolom "Matched By" hanya muncul pada daftar yang barisnya sudah dicocokkan (baris valid)
    const showMatchedBy = rows.some((r) => r && r.matchedBy);
    const totalItems = rows.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div style={{ border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#ffffff' }}>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ textAlign: 'center', width: '70px', padding: '8px', whiteSpace: 'nowrap' }}>Excel Row</th>
                            <th style={{ textAlign: 'left', width: '100px', padding: '8px' }}>Batch / Doc Source</th>
                            <th style={{ textAlign: 'left', padding: '8px', whiteSpace: 'nowrap' }}>Trx Type</th>
                            {showMatchedBy && <th style={{ textAlign: 'left', padding: '8px', whiteSpace: 'nowrap' }}>Matched By</th>}
                            <th style={{ textAlign: 'left', padding: '8px' }}>Lot Number</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Item Code</th>
                            <th style={{ textAlign: 'center', padding: '8px' }}>Lot Status</th>
                            <th style={{ textAlign: 'right', padding: '8px' }}>Qty (Pcs)</th>
                            {/* Kolom Start Datetime dihapus karena sistem baru berbasis Completed Datetime (Trans Date) */}
                            <th style={{ textAlign: 'center', padding: '8px' }}>Completed Datetime</th>
                            {showReason && <th style={{ textAlign: 'left', padding: '8px', minWidth: '200px' }}>Reason</th>}
                            {showChange && <th style={{ textAlign: 'left', padding: '8px', minWidth: '220px' }}>Reason</th>}
                            {showChange && <th style={{ textAlign: 'left', padding: '8px', whiteSpace: 'nowrap' }}>Result</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.length === 0 ? (
                            <tr>
                                <td colSpan={8 + (showReason ? 1 : 0) + (showChange ? 2 : 0) + (showMatchedBy ? 1 : 0)} style={{ textAlign: 'center', padding: '16px', color: '#666' }}>
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row, idx) => {
                                // Tanda dari server (arah jenis transaksi): qty bertanda minus mengurangi alokasi
                                const isReturn = Number(row.rawAllocationQty) < 0;
                                const displayQty = Math.abs(Number(row.qtyPac) || 0);

                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                                        <td style={{ textAlign: 'center', padding: '8px', color: '#6c757d' }}>{row.excelRowNumber || '-'}</td>
                                        <td style={{ fontWeight: 'bold', padding: '8px' }}>{row.batchNumber || row.docSource || '-'}</td>
                                        <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{row.transType || '-'}</td>
                                        {showMatchedBy && <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{row.matchedBy || '-'}</td>}
                                        <td style={{ padding: '8px' }}>{row.lotNumber || '-'}</td>
                                        <td style={{ padding: '8px' }}>{row.itemCode || '-'}</td>
                                        <td style={{ textAlign: 'center', padding: '8px' }}>
                                            {row.lotStatus || '-'}
                                        </td>
                                        <td style={{
                                            textAlign: 'right',
                                            padding: '8px',
                                            fontWeight: 'bold',
                                            color: isReturn ? '#dc3545' : 'inherit'
                                        }}>
                                            {isReturn ? `-${formatQty(displayQty)}` : formatQty(displayQty)}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '8px' }}>{formatDateTime(row.actualCompletedDatetime) || '-'}</td>
                                        {showReason && <td style={{ padding: '8px', color: '#842029' }}>{row.reason || '-'}</td>}
                                        {showChange && <td style={{ padding: '8px', color: '#664d03' }}>{(row.dataChange && row.dataChange.reason) || '-'}</td>}
                                        {showChange && <td style={{ padding: '8px', whiteSpace: 'nowrap', fontWeight: 'bold' }}>{(row.dataChange && row.dataChange.result) || '-'}</td>}
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
