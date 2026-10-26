import React from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';

export const SiDoViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No Delivery Order mapping found for Sales Invoices.
                </td>
            </tr>
        );
    }

    const cellStyle = { padding: '12px 14px', verticalAlign: 'top', lineHeight: '1.4' };

    return mappingList.map((doRow) => {
        const invoices = Array.isArray(doRow.invoices) ? doRow.invoices : [];
        const doRowSpan = invoices.length || 1;

        return invoices.map((inv, idx) => {
            const isFirst = idx === 0;

            return (
                <tr key={`${doRow.do_number}-${inv.si_id || idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                    {isFirst && (
                        <td rowSpan={doRowSpan} style={{ ...cellStyle, backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {doRow.do_number}
                        </td>
                    )}

                    <td style={{ ...cellStyle, fontWeight: '500', whiteSpace: 'nowrap' }}>
                        {inv.si_number}
                    </td>

                    <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {formatDate(inv.si_date)}
                    </td>

                    {/* Product Stacked */}
                    <td style={{ ...cellStyle, minWidth: '220px' }}>
                        <div style={{ fontWeight: 'bold', color: '#212529' }}>{inv.product_code}</div>
                        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{inv.product_name}</div>
                    </td>

                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {formatQty(inv.qty_ctn)}
                    </td>

                    <td style={{ ...cellStyle, textAlign: 'right', color: '#198754', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {formatQty(inv.qty_pcs)}
                    </td>
                </tr>
            );
        });
    });
};

export default SiDoViewRows;
