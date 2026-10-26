import React from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';

export const DoViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No Delivery Order data available.
                </td>
            </tr>
        );
    }

    const cellStyle = {
        padding: '12px 14px',
        verticalAlign: 'top',
        lineHeight: '1.4'
    };

    return mappingList.map((doRow) => {
        const items = Array.isArray(doRow.items) ? doRow.items : [];
        const doRowSpan = items.reduce((acc, item) => {
            const allocCount = Array.isArray(item.allocations) && item.allocations.length > 0 ? item.allocations.length : 1;
            return acc + allocCount;
        }, 0);

        let isFirstItemInDo = true;

        return items.map((itemRow) => {
            const allocations = Array.isArray(itemRow.allocations) && itemRow.allocations.length > 0
                ? itemRow.allocations
                : [{ po_number: '-', lot_number: '-', qty_pcs: 0 }];

            const itemRowSpan = allocations.length;

            return allocations.map((alloc, allocIdx) => {
                const renderDoHeaderCells = isFirstItemInDo && allocIdx === 0;
                const renderItemCells = allocIdx === 0;

                if (renderDoHeaderCells) isFirstItemInDo = false;

                return (
                    <tr key={`${doRow.do_number}-${itemRow.id_product}-${alloc.lot_number}-${allocIdx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                        {/* 1. DO Number & 2. DO Date (Total di bawah DO sudah dibuang) */}
                        {renderDoHeaderCells && (
                            <>
                                <td rowSpan={doRowSpan} style={{ ...cellStyle, backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {doRow.do_number}
                                </td>
                                <td rowSpan={doRowSpan} style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                    {formatDate(doRow.do_created_date)}
                                </td>
                            </>
                        )}

                        {/* 3. Product (Stacked) & 4. Total Item Qty */}
                        {renderItemCells && (
                            <>
                                <td rowSpan={itemRowSpan} style={{ ...cellStyle, minWidth: '220px', backgroundColor: '#fff' }}>
                                    <div style={{ fontWeight: 'bold', color: '#212529' }}>{itemRow.product_code}</div>
                                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{itemRow.product_name}</div>
                                </td>
                                <td rowSpan={itemRowSpan} style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', backgroundColor: '#fff', width: '100px' }}>
                                    {formatQty(itemRow.total_item_qty_pcs)}
                                </td>
                            </>
                        )}

                        {/* 5. Lot Number */}
                        <td style={{ ...cellStyle, fontFamily: 'monospace', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            {alloc.lot_number}
                        </td>

                        {/* 6. Target PO Number */}
                        <td style={{ ...cellStyle, fontWeight: '500', whiteSpace: 'nowrap' }}>
                            {alloc.po_number}
                        </td>

                        {/* 7. Shipped Qty (Pcs) */}
                        <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#198754', width: '100px' }}>
                            {formatQty(alloc.qty_pcs)}
                        </td>
                    </tr>
                );
            });
        });
    });
};

export default DoViewRows;
