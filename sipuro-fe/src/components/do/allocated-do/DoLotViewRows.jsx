import React from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';

export const DoLotViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No lot shipment tracking data available.
                </td>
            </tr>
        );
    }

    return mappingList.map((row) => (
        <tr key={row.lot_id} style={{ borderBottom: '1px solid #dee2e6' }}>
            <td style={{ padding: '10px 14px', fontWeight: 'bold', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {row.lot_number}
            </td>
            <td style={{ padding: '10px 14px', minWidth: '220px' }}>
                <strong>{row.product_code}</strong> - {row.product_name}
            </td>
            <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px' }}>
                {formatDateTime(row.actual_completed_datetime)}
            </td>
            <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px' }}>
                {formatDate(row.expired_date)}
            </td>
            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#198754', whiteSpace: 'nowrap' }}>
                {formatQty(row.total_shipped_qty)} pcs
            </td>
            <td style={{ padding: '10px 14px', fontSize: '12px', color: '#495057' }}>
                {row.shipment_summary || '-'}
            </td>
        </tr>
    ));
};

export default DoLotViewRows;
