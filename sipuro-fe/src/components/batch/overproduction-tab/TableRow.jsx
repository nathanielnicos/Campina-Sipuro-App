import { formatDate, formatQty } from '../../../utils/formatters';

const TableRow = ({ unallocatedList, onOpenModal }) => {
    if (unallocatedList.length === 0) {
        return (
            <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                    No overproduction stock available.
                </td>
            </tr>
        );
    }

    return unallocatedList.map((item) => (
        <tr key={item.id} style={{ borderBottom: '1px solid #dee2e6' }}>
            <td style={{ padding: '12px 16px' }}><strong>{item.batch_number}</strong></td>
            <td style={{ padding: '12px 16px' }}>{item.product_code || '-'}</td>
            <td style={{ padding: '12px 16px' }}>{item.product_name || '-'}</td>
            <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {formatDate(item.production_date)}
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'right', color: '#198754', fontWeight: 'bold' }}>
                {formatQty(item.qty_available)}
            </td>
            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                <button
                    onClick={() => onOpenModal(item)}
                    style={{ backgroundColor: '#0d6efd', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                >
                    Allocate
                </button>
            </td>
        </tr>
    ));
};

export default TableRow;
