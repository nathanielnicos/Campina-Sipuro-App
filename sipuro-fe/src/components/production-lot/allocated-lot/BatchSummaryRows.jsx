import { getStatusStyle } from '../../../utils/statusHelper';
import { formatQty } from '../../../utils/formatters';
import { formatDateTime } from '../../../utils/dateHelper';
import { summarizeBatch } from '../../../hooks/production-lot/allocated-lot/allocationSummary';
import CrossCodeTag from './CrossCodeTag';

// Tampilan By Batch tanpa lot: satu baris per batch, dengan total qty dan qty per PO.
export const BatchSummaryRows = ({ mappingList }) => {
    if (!mappingList || mappingList.length === 0) {
        return (
            <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No batch lot mapping data available.
                </td>
            </tr>
        );
    }

    const cellStyle = { padding: '12px 14px', verticalAlign: 'top', lineHeight: '1.4' };

    return mappingList.map((batch, batchIdx) => {
        const summary = summarizeBatch(batch);

        return (
            <tr key={batch.batch_id ?? `idx-${batchIdx}`} style={{ borderBottom: '1px solid #dee2e6' }}>
                <td style={{ ...cellStyle, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{batch.batch_number}</td>

                <td style={{ ...cellStyle, minWidth: '220px' }}>
                    <div style={{ fontWeight: 'bold', color: '#212529' }}>{batch.product_code}</div>
                    <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{batch.product_name}</div>
                </td>

                <td style={{ ...cellStyle, textAlign: 'center', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {formatDateTime(batch.actual_completed_date)}
                </td>

                <td style={{ ...cellStyle, textAlign: 'center' }}>
                    <span style={getStatusStyle(batch.batch_status)}>{batch.batch_status}</span>
                </td>

                <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{summary.lotCount}</td>

                <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                    {formatQty(summary.totalQty)}
                </td>

                <td style={{ ...cellStyle, minWidth: '300px' }}>
                    {summary.poAllocations.length === 0 ? '-' : summary.poAllocations.map((po) => (
                        <div
                            key={po.key}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '2px 0' }}
                        >
                            <span style={{ fontWeight: '500', whiteSpace: 'nowrap' }}>
                                {po.po_number}
                                <CrossCodeTag show={po.is_cross_code} caption="PO product" productCode={po.po_product_code} />
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontWeight: '500' }}>{formatQty(po.qty)}</span>
                                <span style={getStatusStyle(po.status)}>{po.status}</span>
                            </span>
                        </div>
                    ))}
                </td>
            </tr>
        );
    });
};

export default BatchSummaryRows;
