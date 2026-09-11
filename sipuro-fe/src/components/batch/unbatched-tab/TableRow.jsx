import { formatQty } from '../../../utils/formatters';

const TableRow = ({ row, currentUserRole, isAnyFilterActive, onOpenModal }) => {
    const poItems = row.po_numbers
        ? row.po_numbers.split('\n').filter(Boolean)
        : [];

    const createdDateItems = row.created_dates
        ? row.created_dates.split('\n').filter(Boolean)
        : [];

    const deliveryDateItems = row.requested_delivery_dates
        ? row.requested_delivery_dates.split('\n').filter(Boolean)
        : [];

    return (
        <tr style={{ borderBottom: '1px solid #dee2e6' }}>
            <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                <strong>{row.product_code}</strong>
            </td>

            <td style={{ padding: '12px 10px', verticalAlign: 'middle', maxWidth: '220px', wordBreak: 'break-word' }}>
                {row.product_name}
            </td>

            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                {formatQty(row.total_qty_needed)}
            </td>

            <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                {formatQty(row.total_po_count)}
            </td>

            <td style={{ padding: '12px 10px', textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6' }}>
                {poItems.length > 0 ? (
                    poItems.map((item, idx) => {
                        const poNumber = item.split(' (')[0];
                        return <div key={idx} style={{ fontWeight: '500' }}>{poNumber}</div>;
                    })
                ) : (
                    '-'
                )}
            </td>

            <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6', color: '#495057' }}>
                {createdDateItems.length > 0 ? (
                    createdDateItems.map((dateStr, idx) => (
                        <div key={idx}>{dateStr}</div>
                    ))
                ) : (
                    '-'
                )}
            </td>

            <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap', lineHeight: '1.6', color: '#495057' }}>
                {deliveryDateItems.length > 0 ? (
                    deliveryDateItems.map((dateStr, idx) => (
                        <div key={idx}>{dateStr}</div>
                    ))
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
                        disabled={isAnyFilterActive}
                        title={isAnyFilterActive ? 'Please clear PO number / Date filters before allocating batch schedule' : ''}
                        style={{
                            backgroundColor: isAnyFilterActive ? '#6c757d' : '#0d6efd',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            cursor: isAnyFilterActive ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            fontSize: '11px',
                            lineHeight: '1.2',
                            width: '100px',
                            display: 'inline-block',
                            opacity: isAnyFilterActive ? 0.65 : 1
                        }}
                    >
                        + Production<br />Schedule
                    </button>
                ) : (
                    <span>-</span>
                )}
            </td>
        </tr>
    );
};

export default TableRow;
