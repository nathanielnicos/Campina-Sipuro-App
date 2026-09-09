import Row from './Row';
import PaginationControl from '../../common/PaginationControl';

const Table = ({
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
    const renderSortIcon = (key) => {
        const isSelected = sortConfig.key === key;
        const isAsc = sortConfig.direction === 'asc';

        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '6px', verticalAlign: 'middle' }}>
                {!isSelected ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" />
                    </svg>
                ) : isAsc ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d6efd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m7 15 5-5 5 5" />
                    </svg>
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d6efd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m7 9 5 5 5-5" />
                    </svg>
                )}
            </span>
        );
    };

    return (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden', position: 'relative' }}>
            {fetching && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#6c757d' }}>Updating...</span>
                </div>
            )}

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <th onClick={() => onSort('po_number')} style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
                                PO Number {renderSortIcon('po_number')}
                            </th>
                            <th onClick={() => onSort('created_at')} style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
                                Created Date {renderSortIcon('created_at')}
                            </th>
                            <th onClick={() => onSort('requested_delivery_date')} style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
                                Requested Delivery Date {renderSortIcon('requested_delivery_date')}
                            </th>
                            <th onClick={() => onSort('total_items')} style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
                                Total Items {renderSortIcon('total_items')}
                            </th>
                            {user?.role !== 'PPIC' && (
                                <th onClick={() => onSort('total_price')} style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
                                    Total Price (Inc. PPN) {renderSortIcon('total_price')}
                                </th>
                            )}
                            <th onClick={() => onSort('status')} style={{ padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
                                Status {renderSortIcon('status')}
                            </th>
                            <th style={{ padding: '12px 16px' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {poList.length === 0 ? (
                            <tr>
                                <td colSpan={user?.role === 'PPIC' ? "6" : "7"} style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                    No Purchase Orders created yet.
                                </td>
                            </tr>
                        ) : (
                            poList.map((po) => (
                                <Row
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

export default Table;
