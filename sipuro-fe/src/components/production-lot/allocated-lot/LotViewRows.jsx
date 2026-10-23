import React from 'react';
import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';

export const LotViewRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
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
                                {/* 2. Batch Number */}
                                <td rowSpan={batchRowSpan} style={{ ...cellStyle, fontWeight: '600', whiteSpace: 'nowrap', backgroundColor: '#fcfcfc' }}>
                                    {batchItem.batch_number}
                                </td>

                                {/* 3. Product (Stacked) */}
                                <td rowSpan={batchRowSpan} style={{ ...cellStyle, minWidth: '220px', backgroundColor: '#fcfcfc' }}>
                                    <div style={{ fontWeight: 'bold', color: '#212529' }}>{batchItem.product_code}</div>
                                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{batchItem.product_name}</div>
                                </td>

                                {/* 4. Completed Date */}
                                <td rowSpan={batchRowSpan} style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px', backgroundColor: '#fcfcfc' }}>
                                    {formatDateTime(batchItem.actual_completed_datetime)}
                                </td>

                                {/* 5. Exp Date */}
                                <td rowSpan={batchRowSpan} style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', fontSize: '12px', backgroundColor: '#fcfcfc' }}>
                                    {formatDate(batchItem.expired_date)}
                                </td>
                            </>
                        )}

                        {/* LEVEL 3: PO Allocations (Baris Child Tersendiri) */}
                        {/* 6. PO Number */}
                        <td style={{ ...cellStyle, fontWeight: '500', whiteSpace: 'nowrap' }}>
                            {alloc.po_number || '-'}
                        </td>

                        {/* 7. Allocated Qty */}
                        <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {formatQty(alloc.allocated_qty)}
                        </td>

                        {/* 8. Allocation Status */}
                        <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {alloc.allocation_status && alloc.allocation_status !== '-' ? (
                                <span style={getStatusStyle(alloc.allocation_status)}>
                                    {alloc.allocation_status}
                                </span>
                            ) : '-'}
                        </td>
                    </tr>
                );
            });
        });
    });
};

export default LotViewRows;
