import React from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';

export const SiViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No Sales Invoice data available.
                </td>
            </tr>
        );
    }

    const cellStyle = { padding: '12px 14px', verticalAlign: 'top', lineHeight: '1.4' };

    return mappingList.map((siRow) => {
        const items = Array.isArray(siRow.items) ? siRow.items : [];
        const siRowSpan = items.length || 1;

        return items.map((item, idx) => {
            const isFirst = idx === 0;

            return (
                <tr key={`${siRow.si_number}-${item.si_id || idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                    {isFirst && (
                        <>
                            <td rowSpan={siRowSpan} style={{ ...cellStyle, backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                {siRow.si_number}
                            </td>
                            <td rowSpan={siRowSpan} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fff', whiteSpace: 'nowrap' }}>
                                {formatDate(siRow.si_date)}
                            </td>
                        </>
                    )}

                    <td style={{ ...cellStyle, fontWeight: '500', color: '#0d6efd', whiteSpace: 'nowrap' }}>
                        {item.do_number}
                    </td>

                    {/* Product Stacked */}
                    <td style={{ ...cellStyle, minWidth: '220px' }}>
                        <div style={{ fontWeight: 'bold', color: '#212529' }}>{item.product_code}</div>
                        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{item.product_name}</div>
                    </td>

                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {formatQty(item.qty_ctn)}
                    </td>

                    <td style={{ ...cellStyle, textAlign: 'right', color: '#198754', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        {formatQty(item.qty_pcs)}
                    </td>
                </tr>
            );
        });
    });
};

export default SiViewRows;
