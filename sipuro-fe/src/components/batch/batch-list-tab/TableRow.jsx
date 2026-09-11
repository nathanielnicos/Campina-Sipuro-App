import { getStatusStyle } from '../../../utils/statusHelper';
import { formatDate, formatQty } from '../../../utils/formatters';

const renderActionButton = (status, allocationId, fulfilledQty, currentUserRole, onUpdateStatus) => {
    if (currentUserRole === 'CUSTOMER' || status !== 'Open' || !allocationId) return '-';

    const fulfilled = Number(fulfilledQty) || 0;

    if (fulfilled === 0) {
        return (
            <button
                type="button"
                onClick={() => onUpdateStatus(allocationId, 'CANCEL')}
                style={{
                    padding: '4px 8px',
                    backgroundColor: '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }}
            >
                Cancel
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onUpdateStatus(allocationId, 'FORCE_CLOSE')}
            style={{
                padding: '4px 8px',
                backgroundColor: '#fd7e14',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
            }}
        >
            Force Close
        </button>
    );
};

// Mode: BY BATCH NUMBER (Pas 10 Kolom)
export const BatchViewRows = ({ mappingList, currentUserRole, poTolerance, onUpdateStatus }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No batch mapping data available.
                </td>
            </tr>
        );
    }

    return mappingList.map((row) => {
        const allocations = Array.isArray(row.po_allocations) && row.po_allocations.length > 0
            ? row.po_allocations
            : [{ po_number: '-', allocated_qty: row.total_allocated_qty, fulfilled_qty: row.total_fulfilled_qty, status: '-' }];

        return allocations.map((po, idx) => {
            const target = Number(po.allocated_qty) || 0;
            const fulfilled = Number(po.fulfilled_qty) || 0;
            const percent = target > 0 ? ((fulfilled / target) * 100).toFixed(1) : '0.0';

            return (
                <tr key={`${row.id_batch}-${idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                    {idx === 0 && (
                        <>
                            {/* 1. Batch Number */}
                            <td rowSpan={allocations.length} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff', whiteSpace: 'nowrap' }}>
                                <strong>{row.batch_number}</strong>
                            </td>
                            {/* 2. Product */}
                            <td rowSpan={allocations.length} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff', minWidth: '240px' }}>
                                {currentUserRole !== 'CUSTOMER' ? (
                                    <>
                                        <strong>{row.product_code}</strong> - {row.product_name}
                                    </>
                                ) : (
                                    row.product_name
                                )}
                            </td>
                            {/* 3. Production Dates (Plan & Actual - 2 Baris) */}
                            <td rowSpan={allocations.length} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', backgroundColor: '#fff', fontSize: '12px' }}>
                                <div><span style={{ color: '#6c757d', fontWeight: 'bold' }}>Plan:</span> {formatDate(row.plan_production_date)}</div>
                                <div style={{ marginTop: '4px' }}><span style={{ color: '#6c757d', fontWeight: 'bold' }}>Actual:</span> {formatDate(row.actual_production_date)}</div>
                            </td>
                            {/* 4. Batch Status */}
                            <td rowSpan={allocations.length} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                <span style={{
                                    ...getStatusStyle(row.batch_status),
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    fontSize: '11px',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block'
                                }}>
                                    {row.batch_status}
                                </span>
                            </td>
                        </>
                    )}

                    {/* 5. PO Number */}
                    <td style={{ padding: '10px 14px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                        {po.po_number}
                    </td>
                    {/* 6. Allocation Qty */}
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatQty(target)}
                    </td>
                    {/* 7. Fulfilled Qty */}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#198754', whiteSpace: 'nowrap' }}>
                        {formatQty(fulfilled)}
                    </td>
                    {/* 8. Percentage */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        <span style={{ color: percent >= poTolerance ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                            {percent}%
                        </span>
                    </td>
                    {/* 9. Allocation Status */}
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {po.status !== '-' ? (
                            <span style={{
                                ...getStatusStyle(po.status),
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                display: 'inline-block'
                            }}>
                                {po.status}
                            </span>
                        ) : '-'}
                    </td>
                    {/* 10. Action */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {renderActionButton(po.status, po.allocation_id, po.fulfilled_qty, currentUserRole, onUpdateStatus)}
                    </td>
                </tr>
            );
        });
    });
};

// Mode: BY PO NUMBER (Pas 10 Kolom)
export const PoViewRows = ({ mappingList, currentUserRole, poTolerance, onUpdateStatus }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No PO mapping data available.
                </td>
            </tr>
        );
    }

    return mappingList.map((row) => {
        const batchAllocations = Array.isArray(row.batch_allocations) && row.batch_allocations.length > 0
            ? row.batch_allocations
            : [];

        return batchAllocations.map((batch, idx) => {
            const target = Number(batch.allocated_qty) || 0;
            const fulfilled = Number(batch.fulfilled_qty) || 0;
            const percent = target > 0 ? ((fulfilled / target) * 100).toFixed(1) : '0.0';

            return (
                <tr key={`${row.po_header_id}-${idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                    {idx === 0 && (
                        <>
                            {/* 1. PO Number */}
                            <td rowSpan={batchAllocations.length} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                {row.po_number}
                            </td>
                            {/* 2. PO Created Date */}
                            <td rowSpan={batchAllocations.length} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                {formatDate(row.po_created_date)}
                            </td>
                            {/* 3. PO Requested Delivery Date */}
                            <td rowSpan={batchAllocations.length} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                {formatDate(row.po_requested_delivery_date)}
                            </td>
                        </>
                    )}

                    {/* 4. Product */}
                    <td style={{ padding: '10px 14px', minWidth: '240px' }}>
                        {currentUserRole !== 'CUSTOMER' ? (
                            <>
                                <strong>{batch.product_code}</strong> - {batch.product_name}
                            </>
                        ) : (
                            batch.product_name
                        )}
                    </td>
                    {/* 5. Batch Number */}
                    <td style={{ padding: '10px 14px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                        {batch.batch_number}
                    </td>
                    {/* 6. Allocation Qty */}
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatQty(target)}
                    </td>
                    {/* 7. Fulfilled Qty */}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#198754', whiteSpace: 'nowrap' }}>
                        {formatQty(fulfilled)}
                    </td>
                    {/* 8. Percentage */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        <span style={{ color: percent >= poTolerance ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                            {percent}%
                        </span>
                    </td>
                    {/* 9. Allocation Status */}
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                            ...getStatusStyle(batch.status),
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            display: 'inline-block'
                        }}>
                            {batch.status}
                        </span>
                    </td>
                    {/* 10. Action */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {renderActionButton(batch.status, batch.allocation_id, batch.fulfilled_qty, currentUserRole, onUpdateStatus)}
                    </td>
                </tr>
            );
        });
    });
};
