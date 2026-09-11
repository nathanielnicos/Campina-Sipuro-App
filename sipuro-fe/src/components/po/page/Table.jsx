import React from 'react';
import Row from './Row';
import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';

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
                            <SortableHeader
                                label="PO Number"
                                sortKey="po_number"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                            />
                            <SortableHeader
                                label="Created Date"
                                sortKey="created_at"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                            />
                            <SortableHeader
                                label="Req. Delivery Date"
                                sortKey="requested_delivery_date"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                            />
                            <SortableHeader
                                label="Total Items"
                                sortKey="total_items"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                            />
                            {user?.role === 'CUSTOMER' && (
                                <SortableHeader
                                    label="Total Price (Inc. PPN)"
                                    sortKey="total_price"
                                    currentSortKey={sortConfig?.key}
                                    currentSortOrder={sortConfig?.direction}
                                    onSort={onSort}
                                />
                            )}
                            <SortableHeader
                                label="Status"
                                sortKey="status"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                            />
                            <th style={{ padding: '12px 10px' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {poList.length === 0 ? (
                            <tr>
                                <td colSpan={user?.role !== 'CUSTOMER' ? "6" : "7"} style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
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
