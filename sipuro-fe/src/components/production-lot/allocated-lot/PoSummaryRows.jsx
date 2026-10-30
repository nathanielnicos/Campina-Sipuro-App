import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';
import { summarizePoItem, poItemStatusLabel } from '../../../hooks/production-lot/allocated-lot/allocationSummary';

// Tampilan By PO tanpa lot: satu baris per batch dalam item PO (nomor batch, jumlah lot, dan qty di kolom sendiri).
export const PoSummaryRows = ({ mappingList, poTolerance }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No PO lot mapping data available.
                </td>
            </tr>
        );
    }

    const toleranceVal = Number(poTolerance ?? 100);
    const cellStyle = { padding: '12px 14px', verticalAlign: 'top', lineHeight: '1.4' };

    return mappingList.map((poRow) => {
        const items = (Array.isArray(poRow.products) ? poRow.products : []).map((prodRow) => {
            const { batches } = summarizePoItem(prodRow);
            return { prodRow, batches: batches.length > 0 ? batches : [null] };
        });
        const poRowSpan = items.reduce((sum, item) => sum + item.batches.length, 0);
        let isFirstRowInPo = true;

        return items.map(({ prodRow, batches }) => {
            const percent = Number(prodRow.fulfillment_percentage ?? 0).toFixed(1);
            const statusLabel = poItemStatusLabel(prodRow);
            const itemRowSpan = batches.length;

            return batches.map((batch, batchIdx) => {
                const renderPoCells = isFirstRowInPo;
                const renderItemCells = batchIdx === 0;
                isFirstRowInPo = false;

                return (
                    <tr
                        key={`${poRow.po_header_id}-${prodRow.po_detail_id}-${batch ? batch.batch_id : 'nb'}`}
                        style={{ borderBottom: '1px solid #dee2e6' }}
                    >
                        {renderPoCells && (
                            <>
                                <td rowSpan={poRowSpan} style={{ ...cellStyle, backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {poRow.po_number}
                                </td>
                                <td rowSpan={poRowSpan} style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                    {formatDate(poRow.po_created_date)}
                                </td>
                            </>
                        )}

                        {renderItemCells && (
                            <>
                                <td rowSpan={itemRowSpan} style={{ ...cellStyle, minWidth: '140px', maxWidth: '190px', backgroundColor: '#fff' }}>
                                    <div style={{ fontWeight: 'bold', color: '#212529' }}>{prodRow.product_code}</div>
                                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{prodRow.product_name}</div>
                                </td>
                                <td rowSpan={itemRowSpan} style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', color: '#495057', backgroundColor: '#fff' }}>
                                    {prodRow.po_base_qty > 0 ? formatQty(prodRow.po_base_qty) : '-'}
                                </td>
                            </>
                        )}

                        <td style={{ ...cellStyle, fontWeight: '600', whiteSpace: 'nowrap' }}>{batch ? batch.batch_number : '-'}</td>
                        <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{batch ? batch.lotCount : '-'}</td>
                        <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: '500' }}>
                            {batch ? formatQty(batch.qty) : '-'}
                        </td>

                        {renderItemCells && (
                            <>
                                <td rowSpan={itemRowSpan} style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold', backgroundColor: '#fff' }}>
                                    {formatQty(prodRow.po_fulfilled_qty)}
                                </td>
                                <td rowSpan={itemRowSpan} style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', color: prodRow.remaining_qty > 0 ? '#dc3545' : '#198754', backgroundColor: '#fff' }}>
                                    {formatQty(prodRow.remaining_qty)}
                                </td>
                                <td rowSpan={itemRowSpan} style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold', whiteSpace: 'nowrap', backgroundColor: '#fff' }}>
                                    <span style={{ color: percent >= toleranceVal ? '#198754' : percent > 0 ? '#fd7e14' : '#6c757d' }}>
                                        {percent}%
                                    </span>
                                </td>
                                <td rowSpan={itemRowSpan} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fff' }}>
                                    <span
                                        style={getStatusStyle(statusLabel)}
                                        title={prodRow.close_reason ? `Close reason: ${prodRow.close_reason}` : undefined}
                                    >
                                        {statusLabel}
                                    </span>
                                </td>
                            </>
                        )}
                    </tr>
                );
            });
        });
    });
};

export default PoSummaryRows;
