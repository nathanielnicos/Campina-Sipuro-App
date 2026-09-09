import { formatQty } from '../../../utils/formatters';

const TableRow = ({ row, currentUserRole, isPoFilterActive, onOpenModal }) => {
    const poItems = row.po_numbers
        ? row.po_numbers.split('\n').filter(Boolean)
        : [];

    return (
        <tr style={{ borderBottom: '1px solid #dee2e6' }}>
            <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                <strong>{row.product_code}</strong>
            </td>
            <td style={{ padding: '12px 10px', verticalAlign: 'middle', wordBreak: 'break-word' }}>
                {row.product_name}
            </td>
            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                {formatQty(row.total_qty_needed)}
            </td>
            <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                {formatQty(row.total_po_count)}
            </td>

            <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                {poItems.length > 0 ? (
                    poItems.map((item, idx) => {
                        const poNumber = item.split(' (')[0];
                        return <div key={idx} style={{ fontWeight: '500' }}>{poNumber}</div>;
                    })
                ) : (
                    '-'
                )}
            </td>

            <td style={{ padding: '12px 10px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                {poItems.length > 0 ? (
                    poItems.map((item, idx) => {
                        const match = item.match(/\((.*?)\)/);
                        const rawContent = match ? match[1] : '';
                        const numericPart = rawContent.split(' ')[0];
                        const formattedQty = numericPart ? formatQty(numericPart) : '-';

                        return <div key={idx}>{formattedQty}</div>;
                    })
                ) : (
                    '-'
                )}
            </td>

            <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                {currentUserRole !== 'CUSTOMER' ? (
                    <button
                        onClick={() => onOpenModal(row)}
                        disabled={isPoFilterActive}
                        title={isPoFilterActive ? 'Reset PO number filter for batch allocation' : ''}
                        style={{
                            backgroundColor: isPoFilterActive ? '#6c757d' : '#0d6efd',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: isPoFilterActive ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            fontSize: '12px',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                            opacity: isPoFilterActive ? 0.65 : 1
                        }}
                    >
                        + Production Schedule
                    </button>
                ) : (
                    <span>-</span>
                )}
            </td>
        </tr>
    );
};

export default TableRow;
