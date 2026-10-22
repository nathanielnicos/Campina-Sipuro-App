import React from 'react';
import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';

export const LotViewRows = ({ mappingList, currentUserRole }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No lot mapping data available.
                </td>
            </tr>
        );
    }

    const cellStyle = {
        padding: '12px 14px',
        verticalAlign: 'top',
        lineHeight: '1.4'
    };

    return mappingList.map((row, idx) => (
        <tr key={`${row.lot_id || row.lot_number}-${row.allocation_id || idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
            {/* 1. Lot Number */}
            <td style={{ ...cellStyle, fontWeight: 'bold', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {row.lot_number}
            </td>

            {/* 2. Batch Number */}
            <td style={{ ...cellStyle, fontWeight: '500', whiteSpace: 'nowrap' }}>
                {row.batch_number}
            </td>

            {/* 3. Product (Stacked: Kode di atas, Nama di bawah) */}
            <td style={{ ...cellStyle, minWidth: '220px' }}>
                <div style={{ fontWeight: 'bold', color: '#212529' }}>{row.product_code}</div>
                <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{row.product_name}</div>
            </td>

            {/* 4. Completed Date */}
            <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px' }}>
                {formatDateTime(row.actual_completed_datetime)}
            </td>

            {/* 5. Exp Date */}
            <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px' }}>
                {formatDate(row.expired_date)}
            </td>

            {/* 6. PO Number */}
            <td style={{ ...cellStyle, fontWeight: '500', whiteSpace: 'nowrap' }}>
                {row.po_number || '-'}
            </td>

            {/* 7. Allocated Qty */}
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {formatQty(row.allocated_qty || row.total_allocated_qty)}
            </td>

            {/* 8. Allocation Status */}
            <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {row.allocation_status ? (
                    <span style={getStatusStyle(row.allocation_status)}>
                        {row.allocation_status}
                    </span>
                ) : '-'}
            </td>
        </tr>
    ));
};

export default LotViewRows;
