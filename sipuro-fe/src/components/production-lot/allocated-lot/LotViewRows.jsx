import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';
import AllocationActions from './AllocationActions';
import CrossCodeTag from './CrossCodeTag';

export const LotViewRows = ({ mappingList, actions }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No lot mapping data available.
                </td>
            </tr>
        );
    }

    const cellStyle = {
        padding: '12px 14px',
        verticalAlign: 'top',
        lineHeight: '1.4'
    };

    return mappingList.map((lotGroup) => {
        const batches = Array.isArray(lotGroup.batches) ? lotGroup.batches : [];

        // 1. Hitung total baris untuk seluruh Lot Number (Level 1 Rowspan)
        const lotRowSpan = batches.reduce((acc, b) => {
            const count = Array.isArray(b.allocations) && b.allocations.length > 0 ? b.allocations.length : 1;
            return acc + count;
        }, 0);

        let isFirstBatchInLot = true;

        return batches.map((batchItem) => {
            const allocations = Array.isArray(batchItem.allocations) && batchItem.allocations.length > 0
                ? batchItem.allocations
                : [{ allocation_id: null, po_number: '-', allocated_qty: 0, allocation_status: '-' }];

            // 2. Hitung baris untuk Batch & Produk ini (Level 2 Rowspan)
            const batchRowSpan = allocations.length;
            let isFirstAllocInBatch = true;

            return allocations.map((alloc, aIdx) => {
                const renderLotCells = isFirstBatchInLot && isFirstAllocInBatch && aIdx === 0;
                const renderBatchCells = isFirstAllocInBatch && aIdx === 0;

                if (renderLotCells) isFirstBatchInLot = false;
                if (renderBatchCells) isFirstAllocInBatch = false;

                // Data baris alokasi untuk aksi (edit qty, Force Close, riwayat)
                const allocation = {
                    allocation_id: alloc.allocation_id,
                    status: alloc.allocation_status,
                    allocated_qty: alloc.allocated_qty,
                    po_number: alloc.po_number,
                    po_product_code: alloc.po_product_code,
                    lot_number: lotGroup.lot_number,
                    batch_number: batchItem.batch_number,
                    product_code: batchItem.product_code,
                    product_name: batchItem.product_name
                };

                return (
                    <tr
                        key={`${lotGroup.lot_number}-${batchItem.batch_number}-${batchItem.product_code}-${alloc.allocation_id || aIdx}`}
                        style={{ borderBottom: '1px solid #dee2e6' }}
                    >
                        {/* LEVEL 1: Lot Number (Rowspan seluruh Lot) */}
                        {renderLotCells && (
                            <td rowSpan={lotRowSpan} style={{ ...cellStyle, fontWeight: 'bold', fontFamily: 'monospace', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                {lotGroup.lot_number}
                            </td>
                        )}

                        {/* LEVEL 2: Batch, Product, Completed Date, Exp Date (Rowspan per Batch/Produk) */}
                        {renderBatchCells && (
                            <>
                                <td rowSpan={batchRowSpan} style={{ ...cellStyle, fontWeight: '600', whiteSpace: 'nowrap', backgroundColor: '#fcfcfc' }}>
                                    {batchItem.batch_number}
                                </td>

                                <td rowSpan={batchRowSpan} style={{ ...cellStyle, minWidth: '220px', backgroundColor: '#fcfcfc' }}>
                                    <div style={{ fontWeight: 'bold', color: '#212529' }}>{batchItem.product_code}</div>
                                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{batchItem.product_name}</div>
                                </td>

                                <td rowSpan={batchRowSpan} style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px', backgroundColor: '#fcfcfc' }}>
                                    {formatDateTime(batchItem.actual_completed_datetime)}
                                </td>

                                <td rowSpan={batchRowSpan} style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px', backgroundColor: '#fcfcfc' }}>
                                    {formatDate(batchItem.expired_date)}
                                </td>
                            </>
                        )}

                        {/* LEVEL 3: PO Allocations (Baris Child Tersendiri) */}
                        <td style={{ ...cellStyle, fontWeight: '500', whiteSpace: 'nowrap' }}>
                            {alloc.po_number || '-'}
                            <CrossCodeTag show={alloc.is_cross_code} caption="PO product" productCode={alloc.po_product_code} />
                        </td>

                        <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {formatQty(alloc.allocated_qty)}
                        </td>

                        <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {alloc.allocation_status && alloc.allocation_status !== '-' ? (
                                <span style={getStatusStyle(alloc.allocation_status)}>
                                    {alloc.allocation_status}
                                </span>
                            ) : '-'}
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

export default LotViewRows;
