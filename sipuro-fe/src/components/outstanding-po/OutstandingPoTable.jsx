import PaginationControl from '../common/PaginationControl';
import SortableHeader from '../common/SortableHeader';
import { formatQty } from '../../utils/formatters';
import { getStatusStyle } from '../../utils/statusHelper';
import { getItemActions } from '../../utils/outstandingPoHelpers';

const COLUMN_COUNT = 13;
const plainHeader = (align, width) => ({ padding: '8px 10px', textAlign: align, color: '#495057', fontWeight: '600', width });
const rowSpanCell = (extra) => ({ padding: '12px 10px', verticalAlign: 'middle', ...extra });
const itemCell = (extra) => ({ padding: '8px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#212529', ...extra });

const ActionCell = ({ item, product, roleFlags, onAction }) => {
    const actions = getItemActions(item, roleFlags);
    if (actions.length === 0) {
        return <span style={{ color: '#adb5bd', fontSize: '12px' }}>-</span>;
    }
    if (actions[0] === 'REQUEST_CLOSE') {
        return (
            <button
                type="button"
                onClick={() => onAction('REQUEST_CLOSE', product, item)}
                style={{ padding: '4px 10px', backgroundColor: '#ffc107', color: '#212529', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
                Request Close
            </button>
        );
    }
    return (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            <button
                type="button"
                onClick={() => onAction('APPROVE_CLOSE', product, item)}
                style={{ padding: '4px 8px', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
            >
                Approve
            </button>
            <button
                type="button"
                onClick={() => onAction('REJECT_CLOSE', product, item)}
                style={{ padding: '4px 8px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
            >
                Reject
            </button>
        </div>
    );
};

const ProductRows = ({ product, roleFlags, onAction }) => {
    const items = product.po_items || [];
    const rowSpanCount = Math.max(items.length, 1);

    return items.map((item, idx) => (
        <tr
            key={item.po_detail_id}
            style={{
                borderBottom: idx === items.length - 1 ? '1px solid #dee2e6' : '1px dashed #e9ecef',
                backgroundColor: '#fff'
            }}
        >
            {idx === 0 && (
                <>
                    <td rowSpan={rowSpanCount} style={rowSpanCell({ whiteSpace: 'nowrap' })}>
                        <strong>{product.product_code}</strong>
                    </td>
                    <td rowSpan={rowSpanCount} style={rowSpanCell({ maxWidth: '220px', wordBreak: 'break-word', color: '#212529', fontWeight: '500' })}>
                        {product.product_name}
                    </td>
                    <td rowSpan={rowSpanCount} style={rowSpanCell({ textAlign: 'right', fontWeight: 'bold', color: '#212529' })}>
                        {formatQty(product.total_required_qty)}
                    </td>
                    <td rowSpan={rowSpanCount} style={rowSpanCell({ textAlign: 'right', fontWeight: 'bold', color: '#198754' })}>
                        {formatQty(product.total_produced_qty)}
                    </td>
                    <td rowSpan={rowSpanCount} style={rowSpanCell({ textAlign: 'right', fontWeight: 'bold', color: '#dc3545' })}>
                        {formatQty(product.total_remaining_qty)}
                    </td>
                    <td rowSpan={rowSpanCount} style={rowSpanCell({ textAlign: 'center', color: '#212529' })}>
                        {formatQty(product.total_po_count)}
                    </td>
                </>
            )}

            <td style={itemCell({ textAlign: 'left', fontWeight: '500' })}>{item.po_number || '-'}</td>
            <td style={itemCell({ textAlign: 'center' })}>{item.created_date || '-'}</td>
            <td style={itemCell({ textAlign: 'right' })}>{formatQty(item.required_qty)}</td>
            <td style={itemCell({ textAlign: 'right', color: '#198754', fontWeight: '500' })}>{formatQty(item.produced_qty)}</td>
            <td style={itemCell({ textAlign: 'right', color: '#dc3545', fontWeight: '500' })}>{formatQty(item.remaining_qty)}</td>
            <td style={itemCell({ textAlign: 'center' })}>
                <span style={getStatusStyle(item.status)}>{item.status}</span>
            </td>
            <td style={itemCell({ textAlign: 'center' })}>
                <ActionCell item={item} product={product} roleFlags={roleFlags} onAction={onAction} />
            </td>
        </tr>
    ));
};

const OutstandingPoTable = ({
    rows, sortKey, sortOrder, onSort, pagination, onPageChange, onLimitChange, roleFlags, onAction
}) => (
    <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                        <SortableHeader label={<>Product<br />Code</>} sortKey="product_code"
                            currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={onSort} style={{ width: '110px' }} />
                        <SortableHeader label={<>Product<br />Name</>} sortKey="product_name"
                            currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={onSort} />
                        <SortableHeader label={<>Total Required<br />Qty (Pcs)</>} sortKey="total_required_qty"
                            currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={onSort} align="right" style={{ width: '110px' }} />
                        <SortableHeader label={<>Total Produced<br />Qty (Pcs)</>} sortKey="total_produced_qty"
                            currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={onSort} align="right" style={{ width: '110px' }} />
                        <SortableHeader label={<>Total Remaining<br />Qty (Pcs)</>} sortKey="total_remaining_qty"
                            currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={onSort} align="right" style={{ width: '110px' }} />
                        <SortableHeader label={<>PO<br />Count</>} sortKey="total_po_count"
                            currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={onSort} align="center" style={{ width: '65px' }} />
                        <th style={plainHeader('left', '150px')}>PO Number</th>
                        <th style={plainHeader('center', '100px')}>PO Created<br />Date</th>
                        <th style={plainHeader('right', '110px')}>PO Qty<br />(Pcs)</th>
                        <th style={plainHeader('right', '110px')}>PO Produced<br />Qty (Pcs)</th>
                        <th style={plainHeader('right', '110px')}>PO Remaining<br />Qty (Pcs)</th>
                        <th style={plainHeader('center', '110px')}>Status</th>
                        <th style={plainHeader('center', '120px')}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={COLUMN_COUNT} style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                No outstanding PO items found.
                            </td>
                        </tr>
                    ) : (
                        rows.map((product) => (
                            <ProductRows key={product.id_product} product={product} roleFlags={roleFlags} onAction={onAction} />
                        ))
                    )}
                </tbody>
            </table>
        </div>

        <PaginationControl pagination={pagination} onPageChange={onPageChange} onLimitChange={onLimitChange} />
    </div>
);

export default OutstandingPoTable;
