import { useState, useEffect } from 'react';
import DORow from './DORow';
import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';

const DOTable = ({
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
    // Batch details are shown by default; the user can collapse single rows or all rows.
    const [collapsedIds, setCollapsedIds] = useState(() => new Set());

    // A new page / filter result starts expanded again
    useEffect(() => {
        setCollapsedIds(new Set());
    }, [doList]);

    const toggleRow = (id) => {
        setCollapsedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allCollapsed = doList.length > 0 && collapsedIds.size === doList.length;
    const toggleAll = () => {
        setCollapsedIds(allCollapsed ? new Set() : new Set(doList.map((d) => d.do_id)));
    };

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
                            <th style={{ width: '32px', textAlign: 'center' }}>
                                <button
                                    type="button"
                                    onClick={toggleAll}
                                    title={allCollapsed ? 'Expand all' : 'Collapse all'}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', color: '#6c757d' }}
                                >
                                    {allCollapsed ? '▶' : '▼'}
                                </button>
                            </th>
                            <SortableHeader label="DO Number" sortKey="do_number" {...sortProps} style={{ width: '140px', minWidth: '140px' }} />
                            <SortableHeader label="DO Created Date" sortKey="do_created_date" {...sortProps} style={{ width: '170px', minWidth: '150px' }} />
                            <SortableHeader label="Pick Up Date" sortKey="pick_up_date" {...sortProps} style={{ width: '110px', minWidth: '105px' }} />
                            <SortableHeader label="Product" sortKey="product_name" {...sortProps} style={{ minWidth: '220px' }} />
                            <SortableHeader label="Qty (Ctn)" sortKey="qty_ctn" {...sortProps} align="right" style={{ width: '110px' }} />
                        </tr>
                    </thead>
                    <tbody>
                        {doList.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                    No Delivery Orders found.
                                </td>
                            </tr>
                        ) : (
                            doList.map((item) => (
                                <DORow
                                    key={item.do_id}
                                    item={item}
                                    expanded={!collapsedIds.has(item.do_id)}
                                    onToggle={() => toggleRow(item.do_id)}
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

export default DOTable;
