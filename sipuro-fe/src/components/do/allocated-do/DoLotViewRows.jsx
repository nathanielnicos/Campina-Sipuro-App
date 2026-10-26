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

    const cellStyle = {
        padding: '12px 14px',
        verticalAlign: 'top',
        lineHeight: '1.4'
    };

    return mappingList.map((row, idx) => (
        <tr key={`${row.lot_id}-${row.do_number}-${idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
            {/* 1. Lot Number */}
            <td style={{ ...cellStyle, fontWeight: 'bold', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {row.lot_number}
            </td>

            {/* 2. Product (Stacked: Kode di atas, Nama di bawah) */}
            <td style={{ ...cellStyle, minWidth: '220px' }}>
                <div style={{ fontWeight: 'bold', color: '#212529' }}>{row.product_code}</div>
                <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{row.product_name}</div>
            </td>

            {/* 3. Production Date & 4. Exp Date (Khusus Tanggal Lot) */}
            <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px' }}>
                {formatDateTime(row.actual_completed_datetime)}
            </td>
            <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px' }}>
                {formatDate(row.expired_date)}
            </td>

            {/* 5. DO Number (Dipisah Sendiri) */}
            <td style={{ ...cellStyle, fontWeight: '600', whiteSpace: 'nowrap' }}>
                {row.do_number}
            </td>

            {/* 6. Target PO Number (Dipisah Sendiri) */}
            <td style={{ ...cellStyle, fontWeight: '500', whiteSpace: 'nowrap' }}>
                {row.po_number}
            </td>

            {/* 7. Shipped Qty (Dipisah Sendiri) */}
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', color: '#198754', whiteSpace: 'nowrap' }}>
                {formatQty(row.shipped_qty)} pcs
            </td>
        </tr>
    ));
};

export default DoLotViewRows;
