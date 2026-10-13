import SIRow from './SIRow';
import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';

const SITable = ({
    siList,
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
    const sortProps = {
        currentSortKey: sortConfig?.key,
        currentSortOrder: sortConfig?.direction,
        onSort
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
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <SortableHeader label="Pick Up Date" sortKey="pick_up_date" {...sortProps} style={{ width: '110px', minWidth: '105px' }} />
                            <SortableHeader label="DO Number" sortKey="do_number" {...sortProps} style={{ width: '140px', minWidth: '140px' }} />
                            <SortableHeader label="DO Created Date" sortKey="do_created_date" {...sortProps} style={{ width: '170px', minWidth: '150px' }} />
                            <SortableHeader label="SI Number" sortKey="si_number" {...sortProps} style={{ width: '150px', minWidth: '140px' }} />
                            <SortableHeader label="SI Created Date" sortKey="si_date" {...sortProps} style={{ width: '110px', minWidth: '105px' }} />
                            <SortableHeader label="Product" sortKey="product_name" {...sortProps} style={{ minWidth: '220px' }} />
                            <SortableHeader label="Qty (Ctn)" sortKey="qty_ctn" {...sortProps} align="right" style={{ width: '110px' }} />
                        </tr>
                    </thead>
                    <tbody>
                        {siList.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                    No Sales Invoices found.
                                </td>
                            </tr>
                        ) : (
                            siList.map((item) => <SIRow key={item.si_id} item={item} />)
                        )}
                    </tbody>
                </table>
            </div>

            <PaginationControl
                pagination={{ currentPage, totalPages, totalItems, limit: pageSize }}
                onPageChange={onPageChange}
                onLimitChange={onLimitChange}
            />
        </div>
    );
};

export default SITable;
