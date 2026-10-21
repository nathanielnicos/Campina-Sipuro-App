import React from 'react';
import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';

export const PoLotViewRows = ({ mappingList, currentUserRole, poTolerance }) => {
    // 11 kolom jika non-customer (termasuk Lot, Exp Date), 9 kolom jika customer
    const totalCols = currentUserRole === 'CUSTOMER' ? 9 : 12;

    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan={totalCols} style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No PO lot mapping data available.
                </td>
            </tr>
        );
    }

    const toleranceVal = Number(poTolerance ?? 100);

    return mappingList.map((poRow) => {
        const products = Array.isArray(poRow.products) ? poRow.products : [];

        // 1. Hitung total baris (rowspan) untuk seluruh PO Header
        const poRowSpan = products.reduce((accProd, prod) => {
            const batches = Array.isArray(prod.batches) && prod.batches.length > 0 ? prod.batches : [];
            const lotsInProd = batches.reduce((accB, b) => {
                const lotCount = Array.isArray(b.lots) && b.lots.length > 0 ? b.lots.length : 1;
                return accB + lotCount;
            }, 0);
            return accProd + (lotsInProd > 0 ? lotsInProd : 1);
        }, 0);

        let isFirstProductInPo = true;

        return products.map((prodRow) => {
            const batches = Array.isArray(prodRow.batches) && prodRow.batches.length > 0
                ? prodRow.batches
                : [{ batch_id: null, batch_number: '-', lots: [{ allocation_id: null, lot_number: '-', allocated_qty: 0, status: 'Open' }] }];

            // 2. Hitung total baris (rowspan) untuk Produk
            const prodRowSpan = batches.reduce((accB, b) => {
                const count = Array.isArray(b.lots) && b.lots.length > 0 ? b.lots.length : 1;
                return accB + count;
            }, 0);

            const percent = Number(prodRow.fulfillment_percentage ?? 0).toFixed(1);
            let isFirstBatchInProd = true;

            return batches.map((batchRow) => {
                const lots = Array.isArray(batchRow.lots) && batchRow.lots.length > 0
                    ? batchRow.lots
                    : [{ allocation_id: null, lot_number: '-', allocated_qty: 0, status: 'Open' }];

                // 3. Hitung total baris (rowspan) untuk Batch
                const batchRowSpan = lots.length;
                
                return lots.map((lot, lotIdx) => {
                    const renderPoHeaderCells = isFirstProductInPo && isFirstBatchInProd && lotIdx === 0;
                    const renderProductCells = isFirstBatchInProd && lotIdx === 0;
                    const renderBatchCells = lotIdx === 0;

                    if (renderPoHeaderCells) isFirstProductInPo = false;
                    if (renderProductCells) isFirstBatchInProd = false;

                    return (
                        <tr
                            key={`${poRow.po_header_id}-${prodRow.po_detail_id}-${batchRow.batch_id || 'nb'}-${lot.allocation_id || lotIdx}`}
                            style={{ borderBottom: '1px solid #dee2e6' }}
                        >
                            {/* LEVEL 1: PO HEADER (Rowspan seluruh PO) */}
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

                            {/* LEVEL 2: PRODUCT & PO QTY (Rowspan per Produk) */}
                            {renderProductCells && (
                                <>
                                    <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', minWidth: '220px', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                        {currentUserRole !== 'CUSTOMER' ? (
                                            <>
                                                <strong>{prodRow.product_code}</strong> - {prodRow.product_name}
                                            </>
                                        ) : (
                                            prodRow.product_name
                                        )}
                                    </td>
                                    <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', color: '#495057', verticalAlign: 'top', backgroundColor: '#fff', width: '90px' }}>
                                        {prodRow.po_base_qty > 0 ? formatQty(prodRow.po_base_qty) : '-'}
                                    </td>
                                </>
                            )}

                            {/* LEVEL 3: BATCH (Rowspan per Batch) */}
                            {currentUserRole !== 'CUSTOMER' && renderBatchCells && (
                                <td rowSpan={batchRowSpan} style={{ padding: '10px 14px', fontWeight: '600', whiteSpace: 'nowrap', verticalAlign: 'top', backgroundColor: '#fcfcfc' }}>
                                    {batchRow.batch_number}
                                </td>
                            )}

                            {/* LEVEL 4: LOT DETAILS (Per Baris Lot) */}
                            {currentUserRole !== 'CUSTOMER' && (
                                <>
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: '500' }}>{lot.lot_number}</span>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top', fontSize: '12px', color: '#6c757d' }}>
                                        {formatDate(lot.expired_date)}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', width: '100px', fontWeight: '500' }}>
                                        {formatQty(lot.allocated_qty)}
                                    </td>
                                </>
                            )}

                            {/* STATUS & PERSENTASE PEMENUHAN PRODUK (Rowspan per Produk) */}
                            {renderProductCells && (
                                <>
                                    <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', verticalAlign: 'top', backgroundColor: '#fff', width: '100px' }}>
                                        {formatQty(prodRow.po_fulfilled_qty)}
                                    </td>
                                    <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', color: prodRow.remaining_qty > 0 ? '#dc3545' : '#198754', verticalAlign: 'top', backgroundColor: '#fff', width: '100px' }}>
                                        {formatQty(prodRow.remaining_qty)}
                                    </td>
                                    <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                        <span style={{ color: percent >= toleranceVal ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                                            {percent}%
                                        </span>
                                    </td>
                                    <td rowSpan={prodRowSpan} style={{ padding: '10px 14px', textAlign: 'center', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                        <span style={getStatusStyle(prodRow.status || (prodRow.remaining_qty === 0 ? 'Closed' : 'Open'))}>
                                            {prodRow.status || (prodRow.remaining_qty === 0 ? 'Closed' : 'Open')}
                                        </span>
                                    </td>
                                </>
                            )}
                        </tr>
                    );
                });
            });
        });
    });
};

export default PoLotViewRows;
