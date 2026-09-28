import { getStatusStyle } from '../../../utils/statusHelper';
import { formatCurrency, formatDateTime, formatQty } from '../../../utils/formatters';

const PORow = ({ po, onSelectPODetail, onOpenPdfModal, user }) => {
    const isCustomer = user?.role === 'CUSTOMER';

    // Penerapan Rumus Lebar Kolom
    // Customer: 5x (18%) + y (10%) = 100%
    // Non-Customer: 4x (22%) + y (12%) = 100%
    const colX = isCustomer ? '18%' : '22%';
    const colY = isCustomer ? '10%' : '12%';

    return (
        <tr style={{ borderBottom: '1px solid #dee2e6' }}>
            <td style={{ width: colX, padding: '12px 16px', textAlign: 'left', wordBreak: 'break-word' }}>
                <strong>{po.po_number}</strong>
            </td>
            <td style={{ width: colX, padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {formatDateTime(po.created_at)}
            </td>
            <td style={{ width: colY, padding: '12px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {formatQty(po.total_items)}
            </td>
            {isCustomer && (
                <td style={{ width: colX, padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatCurrency(po.total_amount)}
                </td>
            )}
            <td style={{ width: colX, padding: '12px 16px', textAlign: 'center' }}>
                <span style={getStatusStyle(po.status)}>
                    {po.status}
                </span>
            </td>
            <td style={{ width: colX, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                    <button
                        type="button"
                        onClick={() => onSelectPODetail && onSelectPODetail(po.po_header_id)}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: '#17a2b8',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold'
                        }}
                    >
                        Details
                    </button>

                    {isCustomer && (
                        <button
                            type="button"
                            onClick={() => onOpenPdfModal && onOpenPdfModal(po.po_header_id)}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: '#dc3545',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}
                            title="Open PDF Preview"
                        >
                            📄 PDF
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
};

export default PORow;
