import React from 'react';
import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import AllocationActionButton from './AllocationActionButton';

const formatDateTime = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
};

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
            : [{ po_number: '-', allocated_qty: row.total_allocated_qty, po_base_qty: 0, fulfillment_percentage: 0, status: '-' }];

        const canEditBatch = currentUserRole !== 'CUSTOMER' && row.batch_status === 'Open';

        const startFormatted = formatDateTime(row.actual_production_date);
        const endFormatted = formatDateTime(row.actual_completed_date);

        return allocations.map((po, idx) => {
            const target = Number(po.allocated_qty) || 0;
            const basePoQty = Number(po.po_base_qty) || 0;
            const percent = Number(po.fulfillment_percentage ?? 0).toFixed(1);
            const toleranceVal = Number(poTolerance ?? 100);

            return (
                <tr key={`${row.id_batch}-${po.allocation_id || idx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                    {idx === 0 && (
                        <>
                            {/* 1. Batch Number */}
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
                            {/* 3. Production Date and Time (Baris 1: actual_production_date -, Baris 2: actual_completed_date) */}
                            <td rowSpan={allocations.length} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', backgroundColor: '#fff', fontSize: '12px' }}>
                                <div>{startFormatted !== '-' ? `${startFormatted} -` : '-'}</div>
                                <div>{endFormatted}</div>
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

                    {/* 6. PO Base Qty */}
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', color: '#495057' }}>
                        {basePoQty > 0 ? formatQty(basePoQty) : '-'}
                    </td>

                    {/* 7. Allocation Qty */}
                    <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatQty(target)}
                    </td>

                    {/* 8. Running Total Percentage Keterpenuhan PO */}
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        <span style={{ color: percent >= toleranceVal ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
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
