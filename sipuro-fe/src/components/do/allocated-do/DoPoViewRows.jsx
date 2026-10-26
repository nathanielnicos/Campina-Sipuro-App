import React from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';

export const DoPoViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No PO shipping progress data available.
                </td>
            </tr>
        );
    }

    const cellStyle = {
        padding: '12px 14px',
        verticalAlign: 'top',
        lineHeight: '1.4'
    };

    return mappingList.map((poRow) => {
        const products = Array.isArray(poRow.products) ? poRow.products : [];
        const poRowSpan = products.reduce((acc, p) => acc + (p.deliveries?.length || 1), 0);

        let isFirstProd = true;

        return products.map((prod) => {
            const deliveries = Array.isArray(prod.deliveries) && prod.deliveries.length > 0
                ? prod.deliveries
                : [{ do_number: '-', do_created_date: null, qty_pcs: 0 }];

            const prodRowSpan = deliveries.length;

            return deliveries.map((d, dIdx) => {
                const renderPoCells = isFirstProd && dIdx === 0;
                const renderProdCells = dIdx === 0;

                if (renderPoCells) isFirstProd = false;

                return (
                    <tr key={`${poRow.po_header_id}-${prod.po_detail_id}-${d.do_number}-${dIdx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                        {/* 1. PO Number & 2. PO Date (Status dihapus) */}
                        {renderPoCells && (
                            <>
                                <td rowSpan={poRowSpan} style={{ ...cellStyle, backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {poRow.po_number}
                                </td>
                                <td rowSpan={poRowSpan} style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                    {formatDate(poRow.po_created_date)}
                                </td>
                            </>
                        )}

                        {/* 3. Product (Stacked) & Qty */}
                        {renderProdCells && (
                            <>
                                <td rowSpan={prodRowSpan} style={{ ...cellStyle, minWidth: '220px', backgroundColor: '#fff' }}>
                                    <div style={{ fontWeight: 'bold', color: '#212529' }}>{prod.product_code}</div>
                                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{prod.product_name}</div>
                                </td>
                                <td rowSpan={prodRowSpan} style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', backgroundColor: '#fff', width: '90px' }}>
                                    {formatQty(prod.base_qty)}
                                </td>
                                <td rowSpan={prodRowSpan} style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', backgroundColor: '#fff', width: '90px', fontWeight: '500' }}>
                                    {formatQty(prod.fulfilled_qty)}
                                </td>
                                <td rowSpan={prodRowSpan} style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', backgroundColor: '#fff', width: '90px', fontWeight: 'bold', color: '#198754' }}>
                                    {formatQty(prod.delivered_qty)}
                                </td>
                            </>
                        )}

                        {/* 4. DO Number & 5. DO Date (Dipisah Kolomnya) */}
                        <td style={{ ...cellStyle, fontWeight: '600', whiteSpace: 'nowrap' }}>
                            {d.do_number}
                        </td>
                        <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px' }}>
                            {formatDate(d.do_created_date)}
                        </td>

                        {/* 6. Delivered Qty */}
                        <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                            {d.qty_pcs > 0 ? `${formatQty(d.qty_pcs)} pcs` : '-'}
                        </td>
                    </tr>
                );
            });
        });
    });
};

export default DoPoViewRows;
