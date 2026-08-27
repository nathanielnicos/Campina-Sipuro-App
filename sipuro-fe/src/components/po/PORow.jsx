import React from 'react';
import { getStatusStyle } from '../../utils/statusHelper';
import { formatCurrency, formatDate, formatQty } from '../../utils/formatters';

const PORow = ({ po, onSelectPODetail, user }) => {
    return (
        <tr style={{ borderBottom: '1px solid #dee2e6' }}>
            <td style={{ padding: '12px 16px' }}><strong>{po.po_number}</strong></td>
            <td style={{ padding: '12px 16px' }}>{formatDate(po.created_at)}</td>
            <td style={{ padding: '12px 16px' }}>{formatDate(po.requested_delivery_date)}</td>
            <td style={{ padding: '12px 16px' }}>{formatQty(po.total_items)} SKU</td>
            {user?.role !== 'PPIC' && (
                <td style={{ padding: '12px 16px' }}>{formatCurrency(po.total_amount)}</td>
            )}
            <td style={{ padding: '12px 16px' }}>
                <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'inline-block',
                    ...getStatusStyle(po.status)
                }}>
                    {po.status}
                </span>
            </td>
            <td style={{ padding: '12px 16px' }}>
                <button
                    onClick={() => onSelectPODetail && onSelectPODetail(po.po_header_id)}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#17a2b8',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Detail
                </button>
            </td>
        </tr>
    );
};

export default PORow;
