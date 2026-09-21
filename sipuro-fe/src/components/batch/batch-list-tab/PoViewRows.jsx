import { getStatusStyle } from '../../../utils/statusHelper';
import { formatDate, formatQty } from '../../../utils/formatters';
import AllocationActionButton from './AllocationActionButton';

export const PoViewRows = ({ mappingList, currentUserRole, poTolerance, onUpdateStatus, loading }) => {
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
                        <AllocationActionButton
                            status={batch.status}
                            allocationId={batch.allocation_id}
                            fulfilledQty={batch.fulfilled_qty}
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

export default PoViewRows;
