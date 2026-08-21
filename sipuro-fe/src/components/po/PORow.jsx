import React from 'react';
import { getStatusStyle } from '../../utils/statusHelper';
import { formatCurrency, formatDate } from '../../utils/formatters';

const PORow = ({ po, onSelectPODetail }) => {
    return (
        <tr>
            <td><strong>{po.po_number}</strong></td>
            <td>{formatDate(po.created_at)}</td>
            <td>{formatDate(po.requested_delivery_date)}</td>
            <td>{po.total_items} SKU</td>
            <td>{formatCurrency(po.total_amount)}</td>
            <td>
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
            <td>
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
