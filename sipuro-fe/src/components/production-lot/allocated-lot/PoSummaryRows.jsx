import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';
import { summarizePoItem, poItemStatusLabel } from '../../../hooks/production-lot/allocated-lot/allocationSummary';

// Tampilan By PO tanpa lot: satu baris per item PO, dengan qty per batch.
export const PoSummaryRows = ({ mappingList, poTolerance }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No PO lot mapping data available.
                </td>
            </tr>
        );
    }

    const toleranceVal = Number(poTolerance ?? 100);
    const cellStyle = { padding: '12px 14px', verticalAlign: 'top', lineHeight: '1.4' };

    return mappingList.map((poRow) => {
        const products = Array.isArray(poRow.products) ? poRow.products : [];

        return products.map((prodRow, prodIdx) => {
            const { batches } = summarizePoItem(prodRow);
            const percent = Number(prodRow.fulfillment_percentage ?? 0).toFixed(1);
            const statusLabel = poItemStatusLabel(prodRow);

            return (
                <tr key={`${poRow.po_header_id}-${prodRow.po_detail_id}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                    {prodIdx === 0 && (
                        <>
                            <td rowSpan={products.length} style={{ ...cellStyle, backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                {poRow.po_number}
                            </td>
                            <td rowSpan={products.length} style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                {formatDate(poRow.po_created_date)}
                            </td>
                        </>
                    )}

                    <td style={{ ...cellStyle, minWidth: '220px' }}>
                        <div style={{ fontWeight: 'bold', color: '#212529' }}>{prodRow.product_code}</div>
                        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{prodRow.product_name}</div>
                    </td>

                    <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', color: '#495057' }}>
                        {prodRow.po_base_qty > 0 ? formatQty(prodRow.po_base_qty) : '-'}
                    </td>

                    <td style={{ ...cellStyle, minWidth: '240px' }}>
                        {batches.length === 0 ? '-' : batches.map((batch) => (
                            <div
                                key={batch.batch_id}
                                style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '1px 0' }}
                            >
                                <span>
                                    <span style={{ fontWeight: '600' }}>{batch.batch_number}</span>
                                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#868e96' }}>
                                        {batch.lotCount} {batch.lotCount === 1 ? 'lot' : 'lots'}
                                    </span>
                                </span>
                                <span style={{ fontWeight: '500' }}>{formatQty(batch.qty)}</span>
                            </div>
                        ))}
                    </td>

                    <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                        {formatQty(prodRow.po_fulfilled_qty)}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', color: prodRow.remaining_qty > 0 ? '#dc3545' : '#198754' }}>
                        {formatQty(prodRow.remaining_qty)}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                        <span style={{ color: percent >= toleranceVal ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                            {percent}%
                        </span>
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                        <span
                            style={getStatusStyle(statusLabel)}
                            title={prodRow.close_reason ? `Close reason: ${prodRow.close_reason}` : undefined}
                        >
                            {statusLabel}
                        </span>
                    </td>
                </tr>
            );
        });
    });
};

export default PoSummaryRows;
