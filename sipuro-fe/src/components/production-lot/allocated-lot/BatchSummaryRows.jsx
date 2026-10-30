import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDateTime } from '../../../utils/dateHelper';
import { summarizeBatch } from '../../../hooks/production-lot/allocated-lot/allocationSummary';
import CrossCodeTag from './CrossCodeTag';

// Tampilan By Batch tanpa lot: satu baris per PO dalam batch (nomor PO, qty, dan status alokasi di kolom sendiri).
export const BatchSummaryRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No batch lot mapping data available.
                </td>
            </tr>
        );
    }

    const cellStyle = { padding: '12px 14px', verticalAlign: 'top', lineHeight: '1.4' };

    return mappingList.map((batch, batchIdx) => {
        const summary = summarizeBatch(batch);
        const poRows = summary.poAllocations.length > 0 ? summary.poAllocations : [null];
        const rowSpan = poRows.length;

        return poRows.map((po, poIdx) => (
            <tr key={`${batch.batch_id ?? `idx-${batchIdx}`}-${po ? po.key : 'none'}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                {poIdx === 0 && (
                    <>
                        <td rowSpan={rowSpan} style={{ ...cellStyle, backgroundColor: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {batch.batch_number}
                        </td>

                        <td rowSpan={rowSpan} style={{ ...cellStyle, backgroundColor: '#fff', minWidth: '140px', maxWidth: '190px' }}>
                            <div style={{ fontWeight: 'bold', color: '#212529' }}>{batch.product_code}</div>
                            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{batch.product_name}</div>
                        </td>

                        <td rowSpan={rowSpan} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fff', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {formatDateTime(batch.actual_completed_date)}
                        </td>

                        <td rowSpan={rowSpan} style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#fff' }}>
                            <span style={getStatusStyle(batch.batch_status)}>{batch.batch_status}</span>
                        </td>

                        <td rowSpan={rowSpan} style={{ ...cellStyle, textAlign: 'right', backgroundColor: '#fff', whiteSpace: 'nowrap' }}>
                            {summary.lotCount}
                        </td>

                        <td rowSpan={rowSpan} style={{ ...cellStyle, textAlign: 'right', backgroundColor: '#fff', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                            {formatQty(summary.totalQty)}
                        </td>
                    </>
                )}

                <td style={{ ...cellStyle, fontWeight: '500', whiteSpace: 'nowrap' }}>
                    {po ? po.po_number : '-'}
                    {po && <CrossCodeTag show={po.is_cross_code} caption="PO product" productCode={po.po_product_code} />}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: '500' }}>
                    {po ? formatQty(po.qty) : '-'}
                </td>
                <td style={{ ...cellStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {po ? <span style={getStatusStyle(po.status)}>{po.status}</span> : '-'}
                </td>
            </tr>
        ));
    });
};

export default BatchSummaryRows;
