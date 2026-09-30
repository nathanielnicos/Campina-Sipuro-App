import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';
import Filter from './Filter';
import ViewModeSwitcher from './ViewModeSwitcher';
import BatchViewRows from './BatchViewRows';
import PoViewRows from './PoViewRows';
import EditQtyModal from './EditQtyModal';

import { useAllocatedBatchTable } from '../../../hooks/batch/allocated-batch-tab/useAllocatedBatchTable';

const AllocatedBatchTable = ({ currentUser, reloadTrigger, onRefreshAll }) => {
    const {
        mappingList,
        poTolerance,
        loading,
        error,
        searchQuery,
        batchStatus,
        fromActualDate, setFromActualDate,
        toActualDate, setToActualDate,
        fromCreatedDate, setFromCreatedDate,
        toCreatedDate, setToCreatedDate,
        sortKey,
        sortOrder,
        pagination,
        viewMode,
        exporting,
        setPage,
        setLimit,
        setViewMode,
        handleSearchChange,
        handleStatusChange,
        handleSort,
        handleResetFilters,
        handleExportExcel,
        handleForceClose,
        isEditModalOpen,
        selectedAllocation,
        editLoading,
        handleOpenEditQty,
        handleCloseEditQty,
        handleSaveQty
    } = useAllocatedBatchTable(currentUser, reloadTrigger, onRefreshAll);

    return (
        <div style={{ position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {loading && (
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

            {error && <div style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}

            <Filter
                searchQuery={searchQuery}
                batchStatus={batchStatus}
                fromActualDate={fromActualDate}
                toActualDate={toActualDate}
                fromCreatedDate={fromCreatedDate}
                toCreatedDate={toCreatedDate}
                currentUserRole={currentUser?.role}
                exporting={exporting}
                onSearchChange={handleSearchChange}
                onStatusChange={handleStatusChange}
                onFromActualDateChange={setFromActualDate}
                onToActualDateChange={setToActualDate}
                onFromCreatedDateChange={setFromCreatedDate}
                onToCreatedDateChange={setToCreatedDate}
                onResetFilters={handleResetFilters}
                onExportExcel={handleExportExcel}
            />

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <ViewModeSwitcher
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    currentUserRole={currentUser?.role}
                />

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                {viewMode === 'BY_BATCH' || viewMode === 'BATCH' ? (
                                    <>
                                        {/* Sortable Header */}
                                        <SortableHeader label="Batch Number" sortKey="batch_number" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} />
                                        <SortableHeader label="Product" sortKey="product_name" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} />
                                        <SortableHeader label={<>Production Date<br />and Time</>} sortKey="plan_production_date" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} align="center" />
                                        <SortableHeader label="Batch Status" sortKey="batch_status" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} align="center" />

                                        {/* Standard Header */}
                                        <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>PO Number</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap', width: '110px' }}>
                                            Allocated Qty<br />(Pcs)
                                        </th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Allocation Status</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Action</th>
                                    </>
                                ) : (
                                    <>
                                        <SortableHeader label="PO Number" sortKey="po_number" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} />
                                        <SortableHeader label={<>PO Created<br />Date</>} sortKey="po_created_date" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} align="center" />
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
                            {viewMode === 'BY_BATCH' || viewMode === 'BATCH' ? (
                                <BatchViewRows
                                    mappingList={mappingList}
                                    currentUserRole={currentUser?.role}
                                    onForceClose={handleForceClose}
                                    onOpenEditQty={handleOpenEditQty}
                                    loading={loading}
                                />
                            ) : (
                                <PoViewRows
                                    mappingList={mappingList}
                                    currentUserRole={currentUser?.role}
                                    poTolerance={poTolerance}
                                />
                            )}
                        </tbody>
                    </table>
                </div>

                <PaginationControl
                    pagination={pagination}
                    onPageChange={(newPage) => setPage(newPage)}
                    onLimitChange={(newLimit) => {
                        setLimit(newLimit);
                        setPage(1);
                    }}
                />
            </div>

            <EditQtyModal
                isOpen={isEditModalOpen}
                onClose={handleCloseEditQty}
                allocationData={selectedAllocation}
                onSubmit={handleSaveQty}
                loading={editLoading}
            />
        </div>
    );
};

export default AllocatedBatchTable;
