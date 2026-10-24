import { memo } from 'react';
import { formatQty, formatThousand } from '../../../utils/formatters';

// Satu baris tabel PO Requirement. Dibungkus memo agar mengetik di satu baris
// tidak menggambar ulang ratusan baris lain.
const PORequirementRow = memo(({ row, qty, onQtyChange, onOpenDetail }) => (
    <tr style={{ borderBottom: '1px solid #e9ecef' }}>
        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#212529', borderRight: '1px solid #dee2e6' }}>
            {row.product_code}
        </td>
        <td style={{ padding: '12px 16px', color: '#212529', fontWeight: '500', borderRight: '1px solid #dee2e6' }}>
            {row.product_name}
        </td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#212529', borderRight: '1px solid #dee2e6' }}>
            {formatQty(row.po_outstanding_qty)}
        </td>
        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#212529', borderRight: '1px solid #dee2e6' }}>
            {formatQty(row.total_production_plan_qty)}
        </td>
        <td style={{
            padding: '12px 16px',
            textAlign: 'right',
            fontWeight: 'bold',
            color: row.remaining_qty < 0 ? '#dc3545' : '#198754',
            borderRight: '1px solid #dee2e6'
        }}>
            {formatQty(row.remaining_qty)}
        </td>
        <td style={{ padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #dee2e6' }}>
            <input
                type="text"
                inputMode="numeric"
                value={qty > 0 ? formatThousand(qty) : ''}
                onChange={(e) => onQtyChange(row, e.target.value)}
                placeholder="0"
                style={{
                    width: '120px',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #ced4da',
                    textAlign: 'right',
                    fontSize: '13px',
                    fontWeight: '600',
                    outline: 'none'
                }}
            />
        </td>
        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
            <button
                onClick={() => onOpenDetail(row)}
                style={{
                    backgroundColor: '#0d6efd',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                }}
            >
                View Detail
            </button>
        </td>
    </tr>
));

PORequirementRow.displayName = 'PORequirementRow';

export default PORequirementRow;
