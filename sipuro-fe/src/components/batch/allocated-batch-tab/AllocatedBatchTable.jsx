import React from 'react';
import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';
import Filter from './Filter';
import ViewModeSwitcher from './ViewModeSwitcher';
import BatchViewRows from './BatchViewRows';
import PoViewRows from './PoViewRows';
import EditQtyModal from './EditQtyModal';
import AllocationHistoryModal from './AllocationHistoryModal';

import useFilter from '../../../hooks/batch/allocated-batch-tab/useFilter';
import useViewModeSwitcher from '../../../hooks/batch/allocated-batch-tab/useViewModeSwitcher';
import useAllocatedBatchTable from '../../../hooks/batch/allocated-batch-tab/useAllocatedBatchTable';
import useEditQtyModal from '../../../hooks/batch/allocated-batch-tab/useEditQtyModal';
import useAllocationHistoryModal from '../../../hooks/batch/allocated-batch-tab/useAllocationHistoryModal';

const AllocatedBatchTable = ({ currentUser, reloadTrigger, onRefreshAll }) => {
    // 1. Hook Switcher View Mode (BATCH / PO)
    const modeSwitcher = useViewModeSwitcher(currentUser?.role);

    // 2. Hook Filter & Export
    const filter = useFilter(modeSwitcher.viewMode);

    // 3. Hook Utama Tabel (Fetch Data, Sorting, Pagination & Force Close)
    const tableData = useAllocatedBatchTable(
        currentUser,
        reloadTrigger,
        onRefreshAll,
        filter,
        modeSwitcher.viewMode
    );

    // 4. Hook Modal Edit Quantity
    const editQtyModal = useEditQtyModal(currentUser, onRefreshAll || tableData.refreshData);

    // 5. Hook Modal Allocation History Log
    const historyModal = useAllocationHistoryModal();

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
                    Loading data...
                </div>
            )}

            {tableData.error && <div style={{ color: 'red', marginBottom: '16px' }}>{tableData.error}</div>}

            <Filter
                searchQuery={filter.searchQuery}
                batchStatus={filter.batchStatus}
                fromActualDate={filter.fromActualDate}
                toActualDate={filter.toActualDate}
                fromCreatedDate={filter.fromCreatedDate}
                toCreatedDate={filter.toCreatedDate}
                currentUserRole={currentUser?.role}
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
                    currentUserRole={currentUser?.role}
                />

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                {modeSwitcher.viewMode === 'BY_BATCH' || modeSwitcher.viewMode === 'BATCH' ? (
                                    <>
                                        <SortableHeader label="Batch Number" sortKey="batch_number" currentSortKey={tableData.sortKey} currentSortOrder={tableData.sortOrder} onSort={tableData.handleSort} />
                                        <SortableHeader label="Product" sortKey="product_name" currentSortKey={tableData.sortKey} currentSortOrder={tableData.sortOrder} onSort={tableData.handleSort} />
                                        <SortableHeader label={<>Production Date<br />and Time</>} sortKey="plan_production_date" currentSortKey={tableData.sortKey} currentSortOrder={tableData.sortOrder} onSort={tableData.handleSort} align="center" />
                                        <SortableHeader label="Batch Status" sortKey="batch_status" currentSortKey={tableData.sortKey} currentSortOrder={tableData.sortOrder} onSort={tableData.handleSort} align="center" />

                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>PO Number</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', width: '110px' }}>
                                            Allocated Qty<br />(Pcs)
                                        </th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Allocation Status</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Action</th>
                                    </>
                                ) : (
                                    <>
                                        <SortableHeader label="PO Number" sortKey="po_number" currentSortKey={tableData.sortKey} currentSortOrder={tableData.sortOrder} onSort={tableData.handleSort} />
                                        <SortableHeader label={<>PO Created<br />Date</>} sortKey="po_created_date" currentSortKey={tableData.sortKey} currentSortOrder={tableData.sortOrder} onSort={tableData.handleSort} align="center" />
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Product</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', width: '110px' }}>
                                            PO Qty<br />(Pcs)
                                        </th>
                                        {currentUser?.role !== 'CUSTOMER' && (
                                            <>
                                                <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Batch Number</th>
                                                <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', width: '110px' }}>
                                                    Allocated Qty<br />(Pcs)
                                                </th>
                                            </>
                                        )}
                                        <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', width: '110px' }}>
                                            Fulfilled Qty<br />(Pcs)
                                        </th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', width: '110px' }}>
                                            Remaining Qty<br />(Pcs)
                                        </th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Percentage</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Allocation Status</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {modeSwitcher.viewMode === 'BY_BATCH' || modeSwitcher.viewMode === 'BATCH' ? (
                                <BatchViewRows
                                    mappingList={tableData.mappingList}
                                    currentUserRole={currentUser?.role}
                                    onForceClose={tableData.handleForceClose}
                                    onOpenEditQty={editQtyModal.handleOpenEditQty}
                                    onOpenHistory={historyModal.handleOpenHistoryModal}
                                    loading={tableData.loading}
                                />
                            ) : (
                                <PoViewRows
                                    mappingList={tableData.mappingList}
                                    currentUserRole={currentUser?.role}
                                    poTolerance={tableData.poTolerance}
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

            {/* Modal Edit Quantity */}
            <EditQtyModal
                isOpen={editQtyModal.isEditModalOpen}
                onClose={editQtyModal.handleCloseEditQty}
                allocationData={editQtyModal.selectedAllocation}
                onSubmit={editQtyModal.handleSaveQty}
                loading={editQtyModal.editLoading}
            />

            {/* Modal History Log */}
            <AllocationHistoryModal
                isOpen={historyModal.isHistoryModalOpen}
                onClose={historyModal.handleCloseHistoryModal}
                allocation={historyModal.selectedAllocation}
                logs={historyModal.historyLogs}
                loading={historyModal.historyLoading}
                pagination={historyModal.historyPagination}
                onPageChange={historyModal.handlePageChange}
                onLimitChange={historyModal.handleLimitChange}
            />
        </div>
    );
};

export default AllocatedBatchTable;
