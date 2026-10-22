import React from 'react';
import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';

export const BatchLotViewRows = ({ mappingList, currentUserRole }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No batch lot mapping data available.
                </td>
            </tr>
        );
    }

    // Gaya dasar seragam untuk semua cell
    const cellStyle = {
        padding: '12px 14px',
        verticalAlign: 'top',
        lineHeight: '1.4'
    };

    return mappingList.map((batch) => {
        const lots = Array.isArray(batch.lots) ? batch.lots : [];
        const totalRows = lots.reduce((acc, l) => acc + (l.po_allocations?.length || 1), 0);

        let isFirstBatch = true;

        return lots.map((lot) => {
            const pos = Array.isArray(lot.po_allocations) && lot.po_allocations.length > 0
                ? lot.po_allocations
                : [{ po_number: '-', allocated_qty: 0, status: '-' }];

            const lotRowSpan = pos.length;
            let isFirstLot = true;

            return pos.map((po, poIdx) => {
                const renderBatchCells = isFirstBatch && isFirstLot && poIdx === 0;
                const renderLotCells = isFirstLot && poIdx === 0;

                if (renderBatchCells) isFirstBatch = false;
                if (renderLotCells) isFirstLot = false;

                return (
                    <tr key={`${batch.batch_id}-${lot.lot_id}-${po.allocation_id || poIdx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                        {renderBatchCells && (
                            <>
                                {/* 1. Batch Number */}
                                <td rowSpan={totalRows} style={{ ...cellStyle, backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {batch.batch_number}
                                </td>

                                {/* 2. Product */}
                                <td rowSpan={totalRows} style={{ ...cellStyle, backgroundColor: '#fff', minWidth: '220px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#212529' }}>{batch.product_code}</div>
                                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{batch.product_name}</div>
                                </td>

                                {/* 3. Production Completed Date */}
                                <td rowSpan={totalRows} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fff', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {formatDateTime(batch.actual_completed_date)}
                                </td>

                                {/* 4. Batch Status */}
                                <td rowSpan={totalRows} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fff' }}>
                                    <span style={getStatusStyle(batch.batch_status)}>
                                        {batch.batch_status}
                                    </span>
                                </td>
                            </>
                        )}

                        {renderLotCells && (
                            <>
                                {/* 5. Lot Number */}
                                <td rowSpan={lotRowSpan} style={{ ...cellStyle, backgroundColor: '#fcfcfc', fontFamily: 'monospace', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                    {lot.lot_number}
                                </td>

                                {/* 6. Exp Date */}
                                <td rowSpan={lotRowSpan} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fcfcfc', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {formatDate(lot.expired_date)}
                                </td>
                            </>
                        )}

                        {/* 7. PO Number */}
                        <td style={{ ...cellStyle, fontWeight: '500', whiteSpace: 'nowrap' }}>
                            {po.po_number}
                        </td>

                        {/* 8. Allocated Qty */}
                        <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: '500' }}>
                            {formatQty(po.allocated_qty)}
                        </td>

                        {/* 9. Allocation Status */}
                        <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={getStatusStyle(po.status)}>{po.status}</span>
                        </td>
                    </tr>
                );
            });
        });
    });
};

export default BatchLotViewRows;
