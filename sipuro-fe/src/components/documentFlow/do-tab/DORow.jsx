import { formatQty } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';

const cellStyle = { padding: '10px 12px', fontSize: '13px', verticalAlign: 'top' };
const childCellStyle = { padding: '6px 12px', fontSize: '12px', color: '#495057' };

// Parent row = one Delivery Order line. Child rows = the production batch allocation(s) it was taken from.
const DORow = ({ item, expanded, onToggle }) => {
    const allocations = item.allocations || [];

    return (
        <>
            <tr style={{ borderBottom: expanded && allocations.length > 0 ? 'none' : '1px solid #dee2e6', backgroundColor: '#fff' }}>
                <td style={{ ...cellStyle, width: '32px', textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={onToggle}
                        title={expanded ? 'Hide batch details' : 'Show batch details'}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', color: '#6c757d', padding: 0 }}
                    >
                        {expanded ? '▼' : '▶'}
                    </button>
                </td>
                <td style={{ ...cellStyle, width: '140px', minWidth: '140px' }}><strong>{item.do_number || '-'}</strong></td>
                <td style={{ ...cellStyle, width: '170px', minWidth: '150px' }}>{formatDateTime(item.do_created_date)}</td>
                <td style={{ ...cellStyle, width: '110px', minWidth: '105px' }}>{formatDate(item.pick_up_date)}</td>
                <td style={{ ...cellStyle, minWidth: '220px' }}>
                    {item.product_code ? (
                        <>
                            <strong>{item.product_code}</strong> - {item.product_name}
                        </>
                    ) : '-'}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', width: '110px' }}>
                    {item.qty_ctn !== null && item.qty_ctn !== undefined ? formatQty(item.qty_ctn) : '-'}
                    <div style={{ fontSize: '11px', color: '#6c757d' }}>{formatQty(item.qty_pcs)} pcs</div>
                </td>
            </tr>

            {expanded && (
                <tr style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa' }}>
                    <td />
                    <td colSpan={5} style={{ padding: '4px 12px 10px 12px' }}>
                        {allocations.length === 0 ? (
                            <div style={{ ...childCellStyle, fontStyle: 'italic' }}>No batch allocation recorded.</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ color: '#6c757d', fontSize: '11px', textTransform: 'uppercase', textAlign: 'left' }}>
                                        <th style={{ ...childCellStyle, fontWeight: 'bold' }}>Actual Complete Date &amp; Time</th>
                                        <th style={{ ...childCellStyle, fontWeight: 'bold' }}>PO Number</th>
                                        <th style={{ ...childCellStyle, fontWeight: 'bold' }}>PO Created Date</th>
                                        <th style={{ ...childCellStyle, fontWeight: 'bold' }}>Batch</th>
                                        <th style={{ ...childCellStyle, fontWeight: 'bold', textAlign: 'right' }}>Qty (Ctn)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allocations.map((a) => (
                                        <tr key={a.line_id} style={{ borderTop: '1px solid #e9ecef' }}>
                                            <td style={childCellStyle}>{formatDateTime(a.actual_completed_date)}</td>
                                            <td style={childCellStyle}><strong>{a.po_number || '-'}</strong></td>
                                            <td style={childCellStyle}>{formatDate(a.po_created_date)}</td>
                                            <td style={childCellStyle}>{a.batch_number || '-'}</td>
                                            <td style={{ ...childCellStyle, textAlign: 'right' }}>
                                                {a.qty_ctn !== null && a.qty_ctn !== undefined ? formatQty(a.qty_ctn) : '-'}
                                                <span style={{ color: '#6c757d' }}> ({formatQty(a.qty_pcs)} pcs)</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
};

export default DORow;
