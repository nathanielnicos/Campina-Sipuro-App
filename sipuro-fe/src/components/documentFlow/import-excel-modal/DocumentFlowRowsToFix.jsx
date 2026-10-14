import { useState } from 'react';
import PaginationControl from '../../common/PaginationControl';

// Blocking list: while any row is listed here, saving is disabled and the Excel file must be corrected and re-uploaded.
const DocumentFlowRowsToFix = ({ rows = [] }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [open, setOpen] = useState(true);

    if (!rows.length) return null;

    const totalPages = Math.ceil(rows.length / pageSize) || 1;
    const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div style={{ border: '1px solid #f5c2c7', borderRadius: '6px', marginBottom: '16px', backgroundColor: '#fff' }}>
            <div
                onClick={() => setOpen((v) => !v)}
                style={{ backgroundColor: '#f8d7da', color: '#842029', padding: '10px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}
            >
                <span>⚠️ {rows.length} row(s) must be fixed in the Excel file before saving. Fix them and upload the file again.</span>
                <span>{open ? '▼' : '▶'}</span>
            </div>

            {open && (
                <>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
                                    <th style={{ textAlign: 'left', padding: '8px', width: '80px' }}>Excel Row</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>DO Number</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Item Code</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Customer PO</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Matched Registered PO</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Problem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((row) => (
                                    <tr key={`${row.excelRowNumber}-${row.itemCode}`} style={{ borderBottom: '1px solid #dee2e6', verticalAlign: 'top' }}>
                                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{row.excelRowNumber}</td>
                                        <td style={{ padding: '8px' }}>{row.doNumber || '-'}</td>
                                        <td style={{ padding: '8px' }}>{row.itemCode || '-'}</td>
                                        <td style={{ padding: '8px' }}>{row.customerPoText || '-'}</td>
                                        <td style={{ padding: '8px' }}>{(row.matchedPo || []).join(', ') || '-'}</td>
                                        <td style={{ padding: '8px', color: '#842029' }}>
                                            {(row.problems || []).map((p, i) => (
                                                <div key={i}><strong>{p.column}:</strong> {p.message}</div>
                                            ))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControl
                        pagination={{ currentPage, totalPages, totalItems: rows.length, limit: pageSize }}
                        onPageChange={setCurrentPage}
                        onLimitChange={(l) => { setPageSize(l); setCurrentPage(1); }}
                    />
                </>
            )}
        </div>
    );
};

export default DocumentFlowRowsToFix;
