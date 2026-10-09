import { formatQty } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateHelper';

const cellStyle = { padding: '10px 12px', fontSize: '13px' };
const poDoStyle = { ...cellStyle, width: '140px', minWidth: '140px' };
const dateStyle = { ...cellStyle, width: '105px', minWidth: '105px' };

const SIRow = ({ item }) => {
    return (
        <tr style={{ borderBottom: '1px solid #dee2e6' }}>
            <td style={poDoStyle}><strong>{item.po_number || '-'}</strong></td>
            <td style={poDoStyle}>{item.do_number || '-'}</td>
            <td style={dateStyle}>{formatDate(item.po_created_date)}</td>
            <td style={dateStyle}>{formatDate(item.actual_completed_date)}</td>
            <td style={{ ...cellStyle, width: '280px', minWidth: '220px', lineHeight: '1.4' }}>{item.destination || '-'}</td>
            <td style={{ ...cellStyle, width: '100px' }}>{item.license_plate || '-'}</td>
            <td style={{ ...cellStyle, minWidth: '200px' }}>
                {item.product_code && item.product_name ? (
                    <>
                        <strong>{item.product_code}</strong> - {item.product_name}
                    </>
                ) : (
                    '-'
                )}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right', width: '90px' }}>{item.qty_ctn !== null ? formatQty(item.qty_ctn) : '-'}</td>
            <td style={{ ...cellStyle, minWidth: '120px' }}>{item.description || '-'}</td>
        </tr>
    );
};

export default SIRow;
