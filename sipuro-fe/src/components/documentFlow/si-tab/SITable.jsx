import SIRow from './SIRow';
import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';

const poDoHeaderStyle = { width: '140px', minWidth: '140px' };
const dateHeaderStyle = { width: '105px', minWidth: '105px', whiteSpace: 'normal', lineHeight: '1.2' };

const SITable = ({
    doList,
    fetching,
    sortConfig,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    onSort,
    onPageChange,
    onLimitChange
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
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <SortableHeader
                                label="PO Number"
                                sortKey="po_number"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={poDoHeaderStyle}
                            />
                            <SortableHeader
                                label="DO Number"
                                sortKey="do_number"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={poDoHeaderStyle}
                            />
                            <SortableHeader
                                label="PO Created Date"
                                sortKey="po_created_date"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={dateHeaderStyle}
                            />
                            <SortableHeader
                                label="Actual Complete Date"
                                sortKey="actual_completed_date"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={dateHeaderStyle}
                            />
                            <SortableHeader
                                label="Destination"
                                sortKey="destination"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={{ width: '280px', minWidth: '220px' }}
                            />
                            <SortableHeader
                                label="License Plate"
                                sortKey="license_plate"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={{ width: '100px' }}
                            />
                            <SortableHeader
                                label="Product"
                                sortKey="product_name"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={{ minWidth: '200px' }}
                            />
                            <SortableHeader
                                label="Qty (Ctn)"
                                sortKey="qty_ctn"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={{ textAlign: 'right', width: '90px' }}
                            />
                            <SortableHeader
                                label="Description"
                                sortKey="description"
                                currentSortKey={sortConfig?.key}
                                currentSortOrder={sortConfig?.direction}
                                onSort={onSort}
                                style={{ minWidth: '120px' }}
                            />
                        </tr>
                    </thead>
                    <tbody>
                        {doList.length === 0 ? (
                            <tr>
                                <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                    No Delivery Orders found.
                                </td>
                            </tr>
                        ) : (
                            doList.map((item) => (
                                <SIRow
                                    key={item.allocation_id}
                                    item={item}
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

export default SITable;
