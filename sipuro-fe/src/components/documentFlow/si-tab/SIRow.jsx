import { formatQty } from '../../../utils/formatters';
import { formatDate, formatDateTime } from '../../../utils/dateHelper';

const cellStyle = { padding: '10px 12px', fontSize: '13px', verticalAlign: 'top' };

const SIRow = ({ item }) => (
    <tr style={{ borderBottom: '1px solid #dee2e6', backgroundColor: '#fff' }}>
        <td style={{ ...cellStyle, width: '110px', minWidth: '105px' }}>{formatDate(item.pick_up_date)}</td>
        <td style={{ ...cellStyle, width: '140px', minWidth: '140px' }}>{item.do_number || '-'}</td>
        <td style={{ ...cellStyle, width: '170px', minWidth: '150px' }}>{formatDateTime(item.do_created_date)}</td>
        <td style={{ ...cellStyle, width: '150px', minWidth: '140px' }}><strong>{item.si_number || '-'}</strong></td>
        <td style={{ ...cellStyle, width: '110px', minWidth: '105px' }}>{formatDate(item.si_date)}</td>
        <td style={{ ...cellStyle, minWidth: '220px' }}>
            {item.product_code ? (
                <>
                    <strong>{item.product_code}</strong> - {item.product_name}
                </>
            ) : '-'}
        </td>
        <td style={{ ...cellStyle, textAlign: 'right', width: '110px' }}>
            {item.qty_ctn !== null && item.qty_ctn !== undefined ? formatQty(item.qty_ctn) : '-'}
            <div style={{ fontSize: '11px', color: '#6c757d' }}>{formatQty(item.qty_pcs)} pcs</div>
        </td>
    </tr>
);

export default SIRow;
