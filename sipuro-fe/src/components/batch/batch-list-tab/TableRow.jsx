import { getStatusStyle } from '../../../utils/statusHelper';
import { formatDate, formatQty } from '../../../utils/formatters';

const renderActionButton = (po, currentUserRole, onUpdateStatus) => {
    if (currentUserRole === 'CUSTOMER' || po.status !== 'Open' || !po.allocation_id) return '-';

    const fulfilled = Number(po.fulfilled_qty) || 0;

    if (fulfilled === 0) {
        return (
            <button
                type="button"
                onClick={() => onUpdateStatus(po.allocation_id, 'CANCEL')}
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
            onClick={() => onUpdateStatus(po.allocation_id, 'FORCE_CLOSE')}
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

export const BatchViewRows = ({ mappingList, currentUserRole, poTolerance, onUpdateStatus }) => {
    if (mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
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
                            {currentUserRole !== 'CUSTOMER' && (
                                <td rowSpan={allocations.length} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                    <strong>{row.batch_number}</strong>
                                </td>
                            )}
                            <td rowSpan={allocations.length} style={{ padding: '12px 14px', verticalAlign: 'top', backgroundColor: '#fff' }}>
                                {currentUserRole !== 'CUSTOMER' ? (
                                    <>
                                        <strong>{row.product_code}</strong> - {row.product_name}
                                    </>
                                ) : (
                                    row.product_name
                                )}
                            </td>
                            <td rowSpan={allocations.length} style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                {formatDate(row.plan_production_date)}
                            </td>
                            {currentUserRole !== 'CUSTOMER' && (
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
                            )}
                        </>
                    )}

                    <td style={{ padding: '10px 14px', fontWeight: '500' }}>
                        {po.po_number}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {formatQty(target)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#198754' }}>
                        {formatQty(fulfilled)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold' }}>
                        <span style={{ color: percent >= poTolerance ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                            {percent}%
                        </span>
                    </td>
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
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {renderActionButton(po, currentUserRole, onUpdateStatus)}
                    </td>
                </tr>
            );
        });
    });
};

export const PoViewRows = ({ poList, currentUserRole, poTolerance, onUpdateStatus }) => {
    if (poList.length === 0) {
        return (
            <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No PO mapping data available.
                </td>
            </tr>
        );
    }

    return poList.map((poGroup) => {
        const skuList = Object.values(poGroup.skus);
        let isFirstPoRow = true;

        return skuList.map((skuGroup) => {
            const skuRowCount = skuGroup.batches.length;

            return skuGroup.batches.map((batch, batchIdx) => {
                const target = batch.allocated_qty;
                const fulfilled = batch.fulfilled_qty;
                const percent = target > 0 ? ((fulfilled / target) * 100).toFixed(1) : '0.0';

                const showPoCell = isFirstPoRow;
                const showSkuCell = batchIdx === 0;

                if (isFirstPoRow) isFirstPoRow = false;

                return (
                    <tr key={`${poGroup.po_number}-${skuGroup.product_code}-${batch.batch_number}-${batchIdx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                        {showPoCell && (
                            <td
                                rowSpan={poGroup.totalRowCount}
                                style={{
                                    padding: '12px 14px',
                                    verticalAlign: 'top',
                                    backgroundColor: '#fff',
                                    fontWeight: 'bold',
                                    borderRight: '1px solid #f0f0f0'
                                }}
                            >
                                {poGroup.po_number}
                            </td>
                        )}

                        {showSkuCell && (
                            <td
                                rowSpan={skuRowCount}
                                style={{
                                    padding: '12px 14px',
                                    verticalAlign: 'top',
                                    backgroundColor: '#fff',
                                    borderRight: '1px solid #f0f0f0'
                                }}
                            >
                                {currentUserRole !== 'CUSTOMER' ? (
                                    <>
                                        <strong>{skuGroup.product_code}</strong> - {skuGroup.product_name}
                                    </>
                                ) : (
                                    skuGroup.product_name
                                )}
                            </td>
                        )}

                        {currentUserRole !== 'CUSTOMER' && (
                            <td style={{ padding: '10px 14px', fontWeight: '500' }}>
                                {batch.batch_number}
                            </td>
                        )}
                        <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {formatDate(batch.plan_production_date)}
                        </td>
                        {currentUserRole !== 'CUSTOMER' && (
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span style={{
                                    ...getStatusStyle(batch.batch_status),
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    fontSize: '11px',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block'
                                }}>
                                    {batch.batch_status}
                                </span>
                            </td>
                        )}
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            {formatQty(target)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#198754' }}>
                            {formatQty(fulfilled)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold' }}>
                            <span style={{ color: percent >= poTolerance ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                                {percent}%
                            </span>
                        </td>
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
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {renderActionButton(batch, currentUserRole, onUpdateStatus)}
                        </td>
                    </tr>
                );
            });
        });
    });
};
