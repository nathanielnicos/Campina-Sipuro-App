import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';
import Filter from './Filter';
import ViewModeSwitcher from './ViewModeSwitcher';
import PoLotViewRows from './PoLotViewRows';
import BatchLotViewRows from './BatchLotViewRows';
import LotViewRows from './LotViewRows';
import EditAllocationQtyModal from './EditAllocationQtyModal';
import AllocationHistoryModal from './AllocationHistoryModal';

import useFilter from '../../../hooks/production-lot/allocated-lot/useFilter';
import useViewModeSwitcher from '../../../hooks/production-lot/allocated-lot/useViewModeSwitcher';
import useAllocatedLotTable from '../../../hooks/production-lot/allocated-lot/useAllocatedLotTable';
import useEditAllocationQty from '../../../hooks/production-lot/allocated-lot/useEditAllocationQty';
import useAllocationHistory from '../../../hooks/production-lot/allocated-lot/useAllocationHistory';

const AllocatedLotTable = ({ currentUser, reloadTrigger, onRefreshAll }) => {
    const modeSwitcher = useViewModeSwitcher();
    const filter = useFilter();
    const tableData = useAllocatedLotTable(currentUser, reloadTrigger, filter, modeSwitcher.viewMode);

    // Setelah edit qty, muat ulang lewat pemicu halaman (atau langsung bila tidak ada)
    const refreshAfterAction = onRefreshAll || tableData.refreshData;
    const editQty = useEditAllocationQty(refreshAfterAction);
    const history = useAllocationHistory();

    const actions = {
        busy: editQty.loading,
        onEditQty: editQty.handleOpen,
        onHistory: history.handleOpen
    };

    const isPo = modeSwitcher.viewMode === 'PO' || modeSwitcher.viewMode === 'BY_PO';
    const isBatch = modeSwitcher.viewMode === 'BATCH' || modeSwitcher.viewMode === 'BY_BATCH';
    const isLot = modeSwitcher.viewMode === 'LOT' || modeSwitcher.viewMode === 'BY_LOT';

    return (
        <div style={{ position: 'relative', opacity: tableData.loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {tableData.loading && (
                <div style={{
                    position: 'absolute',
                    top: -25,
                    right: 10,
                    fontSize: '12px',
                    color: '#0d6efd',
                    fontWeight: 'bold',
                    zIndex: 10
                }}>
                    Loading lot mapping data...
                </div>
            )}

            {tableData.error && <div style={{ color: 'red', marginBottom: '16px' }}>{tableData.error}</div>}

            <Filter
                searchQuery={filter.searchQuery}
                status={filter.status}
                fromActualDate={filter.fromActualDate}
                toActualDate={filter.toActualDate}
                fromCreatedDate={filter.fromCreatedDate}
                toCreatedDate={filter.toCreatedDate}
                exporting={filter.exporting}
                onSearchChange={(e) => filter.handleSearchChange(e, tableData.setPage)}
                onStatusChange={(e) => filter.handleStatusChange(e, tableData.setPage)}
                onFromActualDateChange={(val) => filter.handleDateChange(filter.setFromActualDate, val, tableData.setPage)}
                onToActualDateChange={(val) => filter.handleDateChange(filter.setToActualDate, val, tableData.setPage)}
                onFromCreatedDateChange={(val) => filter.handleDateChange(filter.setFromCreatedDate, val, tableData.setPage)}
                onToCreatedDateChange={(val) => filter.handleDateChange(filter.setToCreatedDate, val, tableData.setPage)}
                onResetFilters={() => filter.handleResetFilters(tableData.setPage)}
                onExportExcel={filter.handleExportExcel}
            />

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <ViewModeSwitcher
                    viewMode={modeSwitcher.viewMode}
                    onViewModeChange={modeSwitcher.handleViewModeChange}
                />

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                {isPo && (
                                    <>
                                        <SortableHeader label="PO Number" sortKey="po_number" currentSortKey={tableData.sortKey} currentSortOrder={tableData.sortOrder} onSort={tableData.handleSort} />
                                        <SortableHeader label="PO Created Date" sortKey="po_created_date" currentSortKey={tableData.sortKey} currentSortOrder={tableData.sortOrder} onSort={tableData.handleSort} align="center" />
                                        <th style={{ padding: '12px 14px' }}>Product</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>PO Qty</th>
                                        <th style={{ padding: '12px 14px' }}>Batch No</th>
                                        <th style={{ padding: '12px 14px' }}>Lot No</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Exp Date</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocated Qty</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Fulfilled</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Remaining</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>%</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                                    </>
                                )}

                                {isBatch && (
                                    <>
                                        <th style={{ padding: '12px 14px' }}>Batch Number</th>
                                        <th style={{ padding: '12px 14px' }}>Product</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Production Completed Date</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Batch Status</th>
                                        <th style={{ padding: '12px 14px' }}>Lot Number</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Exp Date</th>
                                        <th style={{ padding: '12px 14px' }}>PO Number</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocated Qty</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Allocation Status</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                                    </>
                                )}

                                {isLot && (
                                    <>
                                        <th style={{ padding: '12px 14px' }}>Lot Number</th>
                                        <th style={{ padding: '12px 14px' }}>Batch Number</th>
                                        <th style={{ padding: '12px 14px' }}>Product</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Completed Date</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Exp Date</th>
                                        <th style={{ padding: '12px 14px' }}>PO Number</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocated Qty</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Allocation Status</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {isPo && (
                                <PoLotViewRows
                                    mappingList={tableData.mappingList}
                                    poTolerance={tableData.poTolerance}
                                    actions={actions}
                                />
                            )}
                            {isBatch && (
                                <BatchLotViewRows
                                    mappingList={tableData.mappingList}
                                    actions={actions}
                                />
                            )}
                            {isLot && (
                                <LotViewRows
                                    mappingList={tableData.mappingList}
                                    actions={actions}
                                />
                            )}
                        </tbody>
                    </table>
                </div>

                <PaginationControl
                    pagination={tableData.pagination}
                    onPageChange={(newPage) => tableData.setPage(newPage)}
                    onLimitChange={(newLimit) => {
                        tableData.setLimit(newLimit);
                        tableData.setPage(1);
                    }}
                />
            </div>

            <EditAllocationQtyModal
                isOpen={editQty.isOpen}
                onClose={editQty.handleClose}
                allocation={editQty.selectedAllocation}
                onSubmit={editQty.handleSave}
                loading={editQty.loading}
            />

            <AllocationHistoryModal
                isOpen={history.isOpen}
                onClose={history.handleClose}
                allocation={history.selectedAllocation}
                logs={history.logs}
                loading={history.loading}
                error={history.error}
                pagination={history.pagination}
                onPageChange={history.handlePageChange}
                onLimitChange={history.handleLimitChange}
            />
        </div>
    );
};

export default AllocatedLotTable;
