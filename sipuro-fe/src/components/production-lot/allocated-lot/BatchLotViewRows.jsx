import React from 'react';
import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';

export const BatchLotViewRows = ({ mappingList, currentUserRole }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No batch lot mapping data available.
                </td>
            </tr>
        );
    }

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
                                <td rowSpan={totalRows} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {batch.batch_number}
                                </td>
                                <td rowSpan={totalRows} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff', minWidth: '220px' }}>
                                    <strong>{batch.product_code}</strong> - {batch.product_name}
                                </td>
                                <td rowSpan={totalRows} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', backgroundColor: '#fff', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    <div>{formatDateTime(batch.actual_production_date)}</div>
                                    <span style={{ ...getStatusStyle(batch.batch_status), marginTop: '4px', display: 'inline-block' }}>
                                        {batch.batch_status}
                                    </span>
                                </td>
                            </>
                        )}

                        {renderLotCells && (
                            <>
                                <td rowSpan={lotRowSpan} style={{ padding: '10px 14px', verticalAlign: 'top', backgroundColor: '#fcfcfc', fontFamily: 'monospace', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                    {lot.lot_number}
                                </td>
                                <td rowSpan={lotRowSpan} style={{ padding: '10px 14px', textAlign: 'center', verticalAlign: 'top', backgroundColor: '#fcfcfc', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {formatDate(lot.expired_date)}
                                </td>
                            </>
                        )}

                        <td style={{ padding: '10px 14px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                            {po.po_number}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: '500' }}>
                            {formatQty(po.allocated_qty)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={getStatusStyle(po.status)}>{po.status}</span>
                        </td>
                    </tr>
                );
            });
        });
    });
};

export default BatchLotViewRows;
