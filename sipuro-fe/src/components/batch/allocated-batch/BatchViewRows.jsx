import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDateTime } from '../../../utils/dateHelper';
import AllocationActionButton from './AllocationActionButton';

export const BatchViewRows = ({ mappingList, currentUserRole, onForceClose, onOpenEditQty, onOpenHistory, loading }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No batch mapping data available.
                </td>
            </tr>
        );
    }

    return mappingList.map((row) => {
        const allocations = Array.isArray(row.po_allocations) && row.po_allocations.length > 0
            ? row.po_allocations
            : [{ po_number: '-', allocated_qty: row.total_allocated_qty, status: '-' }];

        const startFormatted = formatDateTime(row.actual_production_date);
        const endFormatted = formatDateTime(row.actual_completed_date);

        return allocations.map((po, idx) => {
            const target = Number(po.allocated_qty) || 0;
            const canEditQty = currentUserRole !== 'CUSTOMER' && po.allocation_id;
            const hasAllocation = Boolean(po.allocation_id);

            return (
                <tr key={`${row.id_batch || row.batch_number}-${po.allocation_id || po.po_number || idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
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
                            {/* 3. Production Date and Time */}
                            <td rowSpan={allocations.length} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', backgroundColor: '#fff', fontSize: '12px' }}>
                                <div>{startFormatted !== '-' ? `${startFormatted} -` : '-'}</div>
                                <div>{endFormatted}</div>
                            </td>
                            {/* 4. Batch Status */}
                            <td rowSpan={allocations.length} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                <span style={getStatusStyle(row.batch_status)}>
                                    {row.batch_status}
                                </span>
                            </td>
                        </>
                    )}

                    {/* 5. PO Number */}
                    <td style={{ padding: '10px 14px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                        {po.po_number}
                    </td>

                    {/* 6. Allocated Qty (Pcs) */}
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                            {canEditQty && (
                                <button
                                    type="button"
                                    onClick={() => onOpenEditQty(po)}
                                    title="Edit Allocated Quantity"
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
                            <span>{formatQty(target)}</span>
                        </div>
                    </td>

                    {/* 7. Allocation Status */}
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {po.status !== '-' ? (
                            <span style={getStatusStyle(po.status)}>
                                {po.status}
                            </span>
                        ) : '-'}
                    </td>

                    {/* 8. Action */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {/* Tombol History Log selalu dirender */}
                            <button
                                type="button"
                                disabled={!hasAllocation}
                                onClick={() => hasAllocation && onOpenHistory && onOpenHistory({ ...po, batch_number: row.batch_number, product_name: row.product_name, product_code: row.product_code })}
                                title={hasAllocation ? "View Allocation History Log" : "No History Log Available"}
                                style={{
                                    background: 'none',
                                    border: '1px solid #ced4da',
                                    borderRadius: '4px',
                                    cursor: hasAllocation ? 'pointer' : 'not-allowed',
                                    fontSize: '13px',
                                    padding: '3px 7px',
                                    backgroundColor: hasAllocation ? '#fff' : '#e9ecef',
                                    color: hasAllocation ? '#495057' : '#adb5bd',
                                    opacity: hasAllocation ? 1 : 0.6
                                }}
                            >
                                📜
                            </button>

                            {/* Tombol Action Force Close */}
                            <AllocationActionButton
                                status={po.status}
                                allocationId={po.allocation_id}
                                currentUserRole={currentUserRole}
                                onForceClose={onForceClose}
                                loading={loading}
                            />
                        </div>
                    </td>
                </tr>
            );
        });
    });
};

export default BatchViewRows;
