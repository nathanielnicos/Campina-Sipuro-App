import React from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';

export const DoViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No Delivery Order data available.
                </td>
            </tr>
        );
    }

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
                        {/* 1. DO Number & 2. Pick-Up Date */}
                        {renderDoHeaderCells && (
                            <>
                                <td rowSpan={doRowSpan} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    <div>{doRow.do_number}</div>
                                    <div style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'normal' }}>
                                        Total: <strong>{formatQty(doRow.total_qty_pcs)} pcs</strong>
                                    </div>
                                </td>
                                <td rowSpan={doRowSpan} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                    {formatDate(doRow.pick_up_date)}
                                </td>
                            </>
                        )}

                        {/* 3. Product & 4. Item Total Qty */}
                        {renderItemCells && (
                            <>
                                <td rowSpan={itemRowSpan} style={{ padding: '10px 14px', minWidth: '220px', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                    <strong>{itemRow.product_code}</strong> - {itemRow.product_name}
                                </td>
                                <td rowSpan={itemRowSpan} style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', verticalAlign: 'top', backgroundColor: '#fff', width: '100px' }}>
                                    {formatQty(itemRow.total_item_qty_pcs)}
                                </td>
                            </>
                        )}

                        {/* 5. Lot Number */}
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: '500', whiteSpace: 'nowrap' }}>
                            {alloc.lot_number}
                        </td>

                        {/* 6. Target PO Number */}
                        <td style={{ padding: '10px 14px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                            {alloc.po_number}
                        </td>

                        {/* 7. PO Created Date */}
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', color: '#6c757d', whiteSpace: 'nowrap' }}>
                            {formatDate(alloc.po_created_date)}
                        </td>

                        {/* 8. Shipped Qty (Pcs) */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#198754', width: '100px' }}>
                            {formatQty(alloc.qty_pcs)}
                        </td>
                    </tr>
                );
            });
        });
    });
};

export default DoViewRows;
