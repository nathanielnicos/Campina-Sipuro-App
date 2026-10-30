import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';
import AllocationActions from './AllocationActions';
import CrossCodeTag from './CrossCodeTag';
import { sumAllocatedQty } from '../../../hooks/production-lot/allocated-lot/allocationSummary';

export const BatchLotViewRows = ({ mappingList, actions }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
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
        // Total qty batch = jumlah seluruh alokasi dari semua lot di batch ini (selain Canceled)
        const batchTotalQty = sumAllocatedQty(lots.flatMap((l) => l.po_allocations || []));

        let isFirstBatch = true;

        return lots.map((lot) => {
            const pos = Array.isArray(lot.po_allocations) && lot.po_allocations.length > 0
                ? lot.po_allocations
                : [{ allocation_id: null, po_number: '-', allocated_qty: 0, status: '-' }];

            const lotRowSpan = pos.length;
            let isFirstLot = true;

            return pos.map((po, poIdx) => {
                const renderBatchCells = isFirstBatch && isFirstLot && poIdx === 0;
                const renderLotCells = isFirstLot && poIdx === 0;

                if (renderBatchCells) isFirstBatch = false;
                if (renderLotCells) isFirstLot = false;

                // Data baris alokasi untuk aksi (edit qty, riwayat)
                const allocation = {
                    allocation_id: po.allocation_id,
                    status: po.status,
                    allocated_qty: po.allocated_qty,
                    po_number: po.po_number,
                    po_product_code: po.po_product_code,
                    lot_number: lot.lot_number,
                    batch_number: batch.batch_number,
                    product_code: batch.product_code,
                    product_name: batch.product_name
                };

                return (
                    <tr key={`${batch.batch_id}-${lot.lot_id}-${po.allocation_id || poIdx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                        {renderBatchCells && (
                            <>
                                <td rowSpan={totalRows} style={{ ...cellStyle, backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {batch.batch_number}
                                </td>

                                <td rowSpan={totalRows} style={{ ...cellStyle, backgroundColor: '#fff', minWidth: '220px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#212529' }}>{batch.product_code}</div>
                                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{batch.product_name}</div>
                                </td>

                                <td rowSpan={totalRows} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fff', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {formatDateTime(batch.actual_completed_date)}
                                </td>

                                <td rowSpan={totalRows} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fff' }}>
                                    <span style={getStatusStyle(batch.batch_status)}>
                                        {batch.batch_status}
                                    </span>
                                </td>

                                <td rowSpan={totalRows} style={{ ...cellStyle, textAlign: 'right', backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {formatQty(batchTotalQty)}
                                </td>
                            </>
                        )}

                        {renderLotCells && (
                            <>
                                <td rowSpan={lotRowSpan} style={{ ...cellStyle, backgroundColor: '#fcfcfc', fontFamily: 'monospace', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                    {lot.lot_number}
                                </td>

                                <td rowSpan={lotRowSpan} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fcfcfc', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {formatDate(lot.expired_date)}
                                </td>
                            </>
                        )}

                        <td style={{ ...cellStyle, fontWeight: '500', whiteSpace: 'nowrap' }}>
                            {po.po_number}
                            <CrossCodeTag show={po.is_cross_code} caption="PO product" productCode={po.po_product_code} />
                        </td>

                        <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: '500' }}>
                            {formatQty(po.allocated_qty)}
                        </td>

                        <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={getStatusStyle(po.status)}>{po.status}</span>
                        </td>

                        <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <AllocationActions allocation={allocation} {...actions} />
                        </td>
                    </tr>
                );
            });
        });
    });
};

export default BatchLotViewRows;
