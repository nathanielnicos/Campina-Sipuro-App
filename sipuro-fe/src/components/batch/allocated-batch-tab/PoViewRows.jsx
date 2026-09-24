import React from 'react';
import { getStatusStyle } from '../../../utils/statusHelper';
import { formatDate, formatQty } from '../../../utils/formatters';

export const PoViewRows = ({ mappingList, currentUserRole, poTolerance, loading }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No PO mapping data available.
                </td>
            </tr>
        );
    }

    const toleranceVal = Number(poTolerance ?? 100);

    return mappingList.map((poRow) => {
        const products = Array.isArray(poRow.products) ? poRow.products : [];

        // Hitung total baris/rowspan untuk seluruh PO Header
        const poRowSpan = products.reduce((acc, prod) => {
            const batchCount = Array.isArray(prod.batches) && prod.batches.length > 0 ? prod.batches.length : 1;
            return acc + batchCount;
        }, 0);

        let isFirstProductInPo = true;

        return products.map((prodRow) => {
            const batches = Array.isArray(prodRow.batches) && prodRow.batches.length > 0
                ? prodRow.batches
                : [{ allocation_id: null, batch_number: '-', allocated_qty: 0, allocation_status: 'Open' }];

            const prodRowSpan = batches.length;
            const percent = Number(prodRow.fulfillment_percentage ?? 0).toFixed(1);

            return batches.map((batch, batchIdx) => {
                const renderPoHeaderCells = isFirstProductInPo && batchIdx === 0;
                const renderProductCells = batchIdx === 0;

                if (renderPoHeaderCells) {
                    isFirstProductInPo = false;
                }

                return (
                    <tr key={`${poRow.po_header_id}-${prodRow.po_detail_id}-${batch.allocation_id || batchIdx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                        {/* 1. PO Number & 2. PO Created Date (Rowspan per PO) */}
                        {renderPoHeaderCells && (
                            <>
                                <td rowSpan={poRowSpan} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {poRow.po_number}
                                </td>
                                <td rowSpan={poRowSpan} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                    {formatDate(poRow.po_created_date)}
                                </td>
                            </>
                        )}

                        {/* 3. Product & 4. PO Qty (Pcs) (Rowspan per Product/SKU) */}
                        {renderProductCells && (
                            <>
                                <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', minWidth: '240px', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                    {currentUserRole !== 'CUSTOMER' ? (
                                        <>
                                            <strong>{prodRow.product_code}</strong> - {prodRow.product_name}
                                        </>
                                    ) : (
                                        prodRow.product_name
                                    )}
                                </td>
                                <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', color: '#495057', verticalAlign: 'top', backgroundColor: '#fff', width: '110px' }}>
                                    {prodRow.po_base_qty > 0 ? formatQty(prodRow.po_base_qty) : '-'}
                                </td>
                            </>
                        )}

                        {/* 5. Batch Number (Per Baris Batch) */}
                        <td style={{ padding: '10px 14px', fontWeight: '500', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                            {batch.batch_number}
                        </td>

                        {/* 6. Allocated Qty (Pcs) (Per Baris Batch) */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', width: '110px' }}>
                            {formatQty(batch.allocated_qty)}
                        </td>

                        {/* 7. Fulfilled Qty, 8. Remaining Qty, 9. Percentage, 10. Status (Rowspan per Product/SKU) */}
                        {renderProductCells && (
                            <>
                                {/* 7. Fulfilled Qty (Pcs) */}
                                <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', verticalAlign: 'top', backgroundColor: '#fff', width: '110px' }}>
                                    {formatQty(prodRow.po_fulfilled_qty)}
                                </td>

                                {/* 8. Remaining Qty (Pcs) */}
                                <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', color: prodRow.remaining_qty > 0 ? '#dc3545' : '#198754', verticalAlign: 'top', backgroundColor: '#fff', width: '110px' }}>
                                    {formatQty(prodRow.remaining_qty)}
                                </td>

                                {/* 9. Percentage */}
                                <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                    <span style={{ color: percent >= toleranceVal ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                                        {percent}%
                                    </span>
                                </td>

                                {/* 10. Allocation Status */}
                                <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'center', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                    <span style={{
                                        ...getStatusStyle(prodRow.status),
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        whiteSpace: 'nowrap',
                                        display: 'inline-block'
                                    }}>
                                        {prodRow.status}
                                    </span>
                                </td>
                            </>
                        )}
                    </tr>
                );
            });
        });
    });
};

export default PoViewRows;
