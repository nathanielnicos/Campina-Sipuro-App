import { useState } from 'react';
import { formatQty } from '../../../utils/formatters';
import PaginationControl from '../../common/PaginationControl';
import { previewDate, previewDateTime } from './documentFlowFormat';

const th = (align = 'left', extra = {}) => ({ textAlign: align, padding: '8px', ...extra });
const td = (align = 'left', extra = {}) => ({ textAlign: align, padding: '8px', verticalAlign: 'top', ...extra });

const qtyCell = (row) => (
    <>
        {formatQty(row.qtyCtnDO)}
        {row.qtyPcs !== undefined && (
            <div style={{ fontSize: '11px', color: '#6c757d' }}>{formatQty(row.qtyPcs)} pcs</div>
        )}
    </>
);

// Marks the part of the Customer PO cell that does not match any registered PO
const renderCustomerPo = (row) => {
    const text = String(row.customerPoText || '');
    const unknown = (row.unknownPo || []).filter((u) => Number.isInteger(u.start) && Number.isInteger(u.end) && u.end > u.start);
    if (!text || unknown.length === 0) return text || '-';

    const sorted = [...unknown].sort((a, b) => a.start - b.start);
    const parts = [];
    let cursor = 0;
    for (const u of sorted) {
        if (u.start < cursor || u.end > text.length) return text; // inconsistent offsets: show plain text
        if (u.start > cursor) parts.push(<span key={`t${cursor}`}>{text.slice(cursor, u.start)}</span>);
        parts.push(
            <mark key={`u${u.start}`} style={{ backgroundColor: '#f8d7da', color: '#842029', padding: '0 2px' }}>
                {text.slice(u.start, u.end)}
            </mark>
        );
        cursor = u.end;
    }
    if (cursor < text.length) parts.push(<span key={`t${cursor}`}>{text.slice(cursor)}</span>);
    return parts;
};

const COLUMNS = {
    valid: [
        { label: 'Excel Row', render: (r) => <strong>{r.excelRowNumber}</strong>, width: '70px' },
        { label: 'DO Number', render: (r) => r.doNumber },
        { label: 'DO Created Date', render: (r) => previewDateTime(r.doCreatedAt) },
        { label: 'Pick Up Date', render: (r) => previewDate(r.pickUpDate) },
        { label: 'SI Number', render: (r) => r.invoiceNumber },
        { label: 'Product', render: (r) => <><strong>{r.productCode}</strong> - {r.productName}</> },
        { label: 'Qty (Ctn)', align: 'right', render: qtyCell },
        {
            label: 'Allocated From (FIFO)',
            render: (r) => (r.allocations || []).map((a) => (
                <div key={a.allocationId} style={{ whiteSpace: 'nowrap' }}>
                    <strong>{a.poNumber}</strong> · Batch {a.batchNumber || '-'} · {previewDateTime(a.completedAt)} · {formatQty(a.qtyCtn)} ctn ({formatQty(a.qtyPcs)} pcs)
                </div>
            ))
        }
    ],
    duplicate: [
        { label: 'Excel Row', render: (r) => <strong>{r.excelRowNumber}</strong>, width: '70px' },
        { label: 'DO Number', render: (r) => r.doNumber },
        { label: 'SI Number', render: (r) => r.invoiceNumber },
        { label: 'Product', render: (r) => <><strong>{r.productCode}</strong> - {r.productName}</> },
        { label: 'Qty (Ctn)', align: 'right', render: qtyCell },
        { label: 'Reason', render: (r) => r.reason }
    ],
    unregistered: [
        { label: 'Excel Row', render: (r) => <strong>{r.excelRowNumber}</strong>, width: '70px' },
        { label: 'DO Number', render: (r) => r.doNumber },
        { label: 'Item Code', render: (r) => r.itemCode },
        { label: 'Customer PO', render: renderCustomerPo },
        { label: 'Qty (Ctn)', align: 'right', render: qtyCell },
        {
            label: 'Reason',
            render: (r) => (r.reasons || []).map((x, i) => <div key={i} style={{ color: '#842029' }}>{x.message}</div>)
        }
    ],
    nonInterfaced: [
        { label: 'Excel Row', render: (r) => <strong>{r.excelRowNumber}</strong>, width: '70px' },
        { label: 'DO Number', render: (r) => r.doNumber || '-' },
        { label: 'Item Code', render: (r) => r.itemCode || '-' },
        { label: 'Customer PO', render: (r) => r.customerPoText || '-' },
        { label: 'Delivery Status', render: (r) => r.deliveryStatus || '-' },
        { label: 'Qty (Ctn)', align: 'right', render: qtyCell }
    ]
};

const DocumentFlowDataTab = ({ rawData = [], variant = 'valid' }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const columns = COLUMNS[variant] || COLUMNS.valid;
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
                            {columns.map((c) => (
                                <th key={c.label} style={th(c.align, c.width ? { width: c.width } : {})}>{c.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '24px', color: '#6c757d' }}>
                                    No data.
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row) => (
                                <tr key={`${row.excelRowNumber}-${row.itemCode}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                                    {columns.map((c) => (
                                        <td key={c.label} style={td(c.align)}>{c.render(row)}</td>
                                    ))}
                                </tr>
                            ))
                        )}
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

export default DocumentFlowDataTab;
