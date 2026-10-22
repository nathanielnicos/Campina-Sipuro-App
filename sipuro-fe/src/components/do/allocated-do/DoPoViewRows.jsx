import React from 'react';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';
import { getStatusStyle } from '../../../utils/statusHelper';

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

    return mappingList.map((poRow) => {
        const products = Array.isArray(poRow.products) ? poRow.products : [];
        const poRowSpan = products.reduce((acc, p) => acc + (p.deliveries?.length || 1), 0);

        let isFirstProd = true;

        return products.map((prod) => {
            const deliveries = Array.isArray(prod.deliveries) && prod.deliveries.length > 0
                ? prod.deliveries
                : [{ do_number: '-', pick_up_date: null, lot_number: '-', qty_pcs: 0 }];

            const prodRowSpan = deliveries.length;

            return deliveries.map((d, dIdx) => {
                const renderPoCells = isFirstProd && dIdx === 0;
                const renderProdCells = dIdx === 0;

                if (renderPoCells) isFirstProd = false;

                return (
                    <tr key={`${poRow.po_header_id}-${prod.po_detail_id}-${d.do_number}-${dIdx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                        {renderPoCells && (
                            <>
                                <td rowSpan={poRowSpan} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {poRow.po_number}
                                </td>
                                <td rowSpan={poRowSpan} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                    {formatDate(poRow.po_created_date)}
                                </td>
                                <td rowSpan={poRowSpan} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                    <span style={getStatusStyle(poRow.po_status)}>{poRow.po_status}</span>
                                </td>
                            </>
                        )}

                        {renderProdCells && (
                            <>
                                <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', minWidth: '200px', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                    <strong>{prod.product_code}</strong> - {prod.product_name}
                                </td>
                                <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', backgroundColor: '#fff', width: '90px' }}>
                                    {formatQty(prod.base_qty)}
                                </td>
                                <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', backgroundColor: '#fff', width: '90px', fontWeight: '500' }}>
                                    {formatQty(prod.fulfilled_qty)}
                                </td>
                                <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', backgroundColor: '#fff', width: '90px', fontWeight: 'bold', color: '#198754' }}>
                                    {formatQty(prod.delivered_qty)}
                                </td>
                            </>
                        )}

                        {/* Rincian Surat Jalan (DO) */}
                        <td style={{ padding: '10px 14px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            {d.do_number} {d.pick_up_date ? `(${formatDate(d.pick_up_date)})` : ''}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                            {d.qty_pcs > 0 ? `${formatQty(d.qty_pcs)} pcs` : '-'}
                        </td>
                    </tr>
                );
            });
        });
    });
};

export default DoPoViewRows;
