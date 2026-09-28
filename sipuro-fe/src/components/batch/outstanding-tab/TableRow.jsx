import { formatQty } from '../../../utils/formatters';
import { getStatusStyle } from '../../../utils/statusHelper';

const TableRow = ({ row, currentUser, onOpenConfirm }) => {
    let items = [];
    if (row.po_items && Array.isArray(row.po_items) && row.po_items.length > 0) {
        items = row.po_items;
    } else if (row.po_numbers) {
        const headerIdList = row.po_header_ids ? row.po_header_ids.split('\n').filter(Boolean) : [];
        const detailIdList = row.po_detail_ids ? row.po_detail_ids.split('\n').filter(Boolean) : [];
        const poList = row.po_numbers.split('\n').filter(Boolean);
        const createdList = row.created_dates ? row.created_dates.split('\n').filter(Boolean) : [];
        const requiredQtyList = row.po_required_qtys ? row.po_required_qtys.split('\n').filter(Boolean) : [];
        const remainingQtyList = row.po_remaining_qtys ? row.po_remaining_qtys.split('\n').filter(Boolean) : [];
        const statusList = row.po_statuses ? row.po_statuses.split('\n').filter(Boolean) : [];

        items = poList.map((poNumber, idx) => ({
            po_header_id: headerIdList[idx] || null,
            po_detail_id: detailIdList[idx] || null,
            po_number: poNumber,
            created_date: createdList[idx] || '-',
            required_qty: requiredQtyList[idx] || 0,
            remaining_qty: remainingQtyList[idx] || 0,
            status: statusList[idx] || 'Active'
        }));
    }

    const isCustomer = currentUser?.role?.toUpperCase() === 'CUSTOMER' || currentUser?.is_customer;
    const rowSpanCount = items.length > 0 ? items.length : 1;

    if (items.length === 0) {
        return (
            <tr style={{ borderBottom: '1px solid #f1f3f5' }}>
                <td style={{ padding: '12px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <strong>{row.product_code}</strong>
                </td>
                <td style={{ padding: '12px 10px', verticalAlign: 'middle', maxWidth: '220px', wordBreak: 'break-word', color: '#212529', fontWeight: '500' }}>
                    {row.product_name}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                    {formatQty(row.total_required_qty)}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle', color: '#dc3545' }}>
                    {formatQty(row.total_remaining_qty)}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'middle', color: '#212529' }}>
                    {formatQty(row.total_po_count)}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#868e96' }}>-</td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#868e96' }}>-</td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#868e96' }}>-</td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#868e96' }}>-</td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#868e96' }}>-</td>
                <td style={{ padding: '12px 10px', textAlign: 'center', color: '#868e96' }}>-</td>
            </tr>
        );
    }

    return (
        <>
            {items.map((item, idx) => {
                const isFirstRow = idx === 0;
                const isLastRow = idx === items.length - 1;

                return (
                    <tr
                        key={`${row.id_product}-${idx}`}
                        style={{
                            borderBottom: isLastRow ? '1px solid #dee2e6' : '1px dashed #e9ecef',
                            backgroundColor: '#fff'
                        }}
                    >
                        {isFirstRow && (
                            <>
                                <td
                                    rowSpan={rowSpanCount}
                                    style={{
                                        padding: '12px 10px',
                                        verticalAlign: 'middle',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <strong>{row.product_code}</strong>
                                </td>

                                <td
                                    rowSpan={rowSpanCount}
                                    style={{
                                        padding: '12px 10px',
                                        verticalAlign: 'middle',
                                        maxWidth: '220px',
                                        wordBreak: 'break-word',
                                        color: '#212529',
                                        fontWeight: '500'
                                    }}
                                >
                                    {row.product_name}
                                </td>

                                <td
                                    rowSpan={rowSpanCount}
                                    style={{
                                        padding: '12px 10px',
                                        textAlign: 'right',
                                        fontWeight: 'bold',
                                        verticalAlign: 'middle',
                                        color: '#212529'
                                    }}
                                >
                                    {formatQty(row.total_required_qty)}
                                </td>

                                <td
                                    rowSpan={rowSpanCount}
                                    style={{
                                        padding: '12px 10px',
                                        textAlign: 'right',
                                        fontWeight: 'bold',
                                        verticalAlign: 'middle',
                                        color: '#dc3545'
                                    }}
                                >
                                    {formatQty(row.total_remaining_qty)}
                                </td>

                                <td
                                    rowSpan={rowSpanCount}
                                    style={{
                                        padding: '12px 10px',
                                        textAlign: 'center',
                                        verticalAlign: 'middle',
                                        color: '#212529'
                                    }}
                                >
                                    {formatQty(row.total_po_count)}
                                </td>
                            </>
                        )}

                        <td style={{ padding: '8px 10px', textAlign: 'left', verticalAlign: 'middle', whiteSpace: 'nowrap', fontWeight: '500', color: '#212529' }}>
                            {item.po_number || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#212529' }}>
                            {item.created_date || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#212529' }}>
                            {formatQty(item.required_qty)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#dc3545', fontWeight: '500' }}>
                            {formatQty(item.remaining_qty)}
                        </td>

                        {/* Kolom Status */}
                        <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <span style={getStatusStyle(item.status)}>
                                {item.status}
                            </span>
                        </td>

                        {/* Kolom Action */}
                        <td style={{ padding: '8px 10px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            {isCustomer ? (
                                item.status === 'Active' ? (
                                    <button
                                        onClick={() => onOpenConfirm('REQUEST_CLOSE', item.po_header_id, item.po_detail_id, item.po_number, row.product_name)}
                                        style={{
                                            padding: '4px 10px',
                                            backgroundColor: '#ffc107',
                                            color: '#212529',
                                            border: 'none',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Request Close
                                    </button>
                                ) : (
                                    <span style={{ color: '#adb5bd', fontSize: '12px' }}>-</span>
                                )
                            ) : (
                                item.status === 'Close Requested' ? (
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => onOpenConfirm('APPROVE_CLOSE', item.po_header_id, item.po_detail_id, item.po_number, row.product_name)}
                                            style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#198754',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => onOpenConfirm('REJECT_CLOSE', item.po_header_id, item.po_detail_id, item.po_number, row.product_name)}
                                            style={{
                                                padding: '4px 8px',
                                                backgroundColor: '#dc3545',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                ) : (
                                    <span style={{ color: '#adb5bd', fontSize: '12px' }}>-</span>
                                )
                            )}
                        </td>
                    </tr>
                );
            })}
        </>
    );
};

export default TableRow;
