import { getStatusStyle } from '../../../utils/statusHelper';
import { formatDate, formatQty } from '../../../utils/formatters';
import AllocationActionButton from './AllocationActionButton';

export const BatchViewRows = ({ mappingList, currentUserRole, poTolerance, onUpdateStatus, onOpenEditBatch, loading }) => {
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

        const canEditBatch = currentUserRole !== 'CUSTOMER' && row.batch_status === 'Open';

        return allocations.map((po, idx) => {
            const target = Number(po.allocated_qty) || 0;
            const fulfilled = Number(po.fulfilled_qty) || 0;
            const percent = target > 0 ? ((fulfilled / target) * 100).toFixed(1) : '0.0';

            return (
                <tr key={`${row.id_batch}-${idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                    {idx === 0 && (
                        <>
                            {/* 1. Batch Number dengan Tombol Edit */}
                            <td rowSpan={allocations.length} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <strong>{row.batch_number}</strong>
                                    {canEditBatch && (
                                        <button
                                            type="button"
                                            onClick={() => onOpenEditBatch(row)}
                                            title="Edit Batch Number"
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                padding: '2px 4px',
                                                color: '#0d6efd'
                                            }}
                                        >
                                            ✏️
                                        </button>
                                    )}
                                </div>
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
                            {/* 3. Production Dates */}
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
                        <AllocationActionButton
                            status={po.status}
                            allocationId={po.allocation_id}
                            fulfilledQty={po.fulfilled_qty}
                            currentUserRole={currentUserRole}
                            onUpdateStatus={onUpdateStatus}
                            loading={loading}
                        />
                    </td>
                </tr>
            );
        });
    });
};

export default BatchViewRows;
