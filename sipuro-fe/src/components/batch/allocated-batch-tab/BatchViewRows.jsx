import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDateTime } from '../../../utils/dateHelper';
import AllocationActionButton from './AllocationActionButton';

export const BatchViewRows = ({ mappingList, currentUserRole, onForceClose, onOpenEditQty, loading }) => {
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
            const canEditQty = currentUserRole !== 'CUSTOMER' && po.status === 'Open' && po.allocation_id;

            return (
                <tr key={`${row.id_batch}-${po.allocation_id || idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
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

                    {/* 6. Allocated Qty (Pcs) - Tombol pensil di depan angka */}
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
                        <AllocationActionButton
                            status={po.status}
                            allocationId={po.allocation_id}
                            currentUserRole={currentUserRole}
                            onForceClose={onForceClose}
                            loading={loading}
                        />
                    </td>
                </tr>
            );
        });
    });
};

export default BatchViewRows;
