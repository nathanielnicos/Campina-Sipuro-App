import PORow from './PORow';
import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';

const POTable = ({
    poList,
    fetching,
    sortConfig,
    user,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onSort,
    onPageChange,
    onLimitChange,
    onSelectPODetail,
    onOpenPdfModal
}) => {
    const isCustomer = user?.role === 'CUSTOMER';
    const totalColumns = isCustomer ? 6 : 5;

    // Penerapan Rumus Lebar Kolom
    // Customer: 5x (18%) + y (10%) = 100%
    // Non-Customer: 4x (22%) + y (12%) = 100%
    const colX = isCustomer ? '18%' : '22%';
    const colY = isCustomer ? '10%' : '12%';

    return (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden', position: 'relative' }}>
            {fetching && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    backdropFilter: 'blur(2px)',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#6c757d' }}>Updating...</span>
                </div>
            )}

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <SortableHeader
                                label="PO Number"
                                sortKey="po_number"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={{ width: colX, textAlign: 'left', padding: '12px 16px' }}
                            />
                            <SortableHeader
                                label="Created Date & Time"
                                sortKey="created_at"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={{ width: colX, textAlign: 'center', padding: '12px 16px' }}
                            />
                            <SortableHeader
                                label="Total Items"
                                sortKey="total_items"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={{ width: colY, textAlign: 'center', padding: '12px 8px' }}
                            />
                            {isCustomer && (
                                <SortableHeader
                                    label="Total Price (Inc. VAT)"
                                    sortKey="total_price"
                                    currentSortKey={sortConfig?.key}
                                    currentSortOrder={sortConfig?.direction}
                                    onSort={onSort}
                                    style={{ width: colX, textAlign: 'right', padding: '12px 16px' }}
                                />
                            )}
                            <SortableHeader
                                label="Status"
                                sortKey="status"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={{ width: colX, textAlign: 'center', padding: '12px 16px' }}
                            />
                            <th style={{ width: colX, padding: '12px 16px', textAlign: 'center' }}>
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {poList.length === 0 ? (
                            <tr>
                                <td colSpan={totalColumns} style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                    No Purchase Orders created yet.
                                </td>
                            </tr>
                        ) : (
                            poList.map((po) => (
                                <PORow
                                    key={po.po_header_id}
                                    po={po}
                                    user={user}
                                    onSelectPODetail={onSelectPODetail}
                                    onOpenPdfModal={onOpenPdfModal}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <PaginationControl
                pagination={{
                    currentPage,
                    totalPages,
                    totalItems,
                    limit: pageSize
                }}
                onPageChange={onPageChange}
                onLimitChange={onLimitChange}
            />
        </div>
    );
};

export default POTable;
