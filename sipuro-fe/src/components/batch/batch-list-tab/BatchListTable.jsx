import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';
import Filter from './Filter';
import ViewModeSwitcher from './ViewModeSwitcher';
import BatchViewRows from './BatchViewRows';
import PoViewRows from './PoViewRows';
import EditBatchModal from './EditBatchModal';

// Hook Custom
import { useBatchListTable } from '../../../hooks/batch/batch-list-tab/useBatchListTable';

const BatchListTable = ({ currentUser, reloadTrigger, onRefreshAll }) => {
    const {
        mappingList,
        poTolerance,
        loading,
        error,
        searchQuery,
        batchStatus,
        fromPlanDate, setFromPlanDate,
        toPlanDate, setToPlanDate,
        fromActualDate, setFromActualDate,
        toActualDate, setToActualDate,
        fromCreatedDate, setFromCreatedDate,
        toCreatedDate, setToCreatedDate,
        fromDeliveryDate, setFromDeliveryDate,
        toDeliveryDate, setToDeliveryDate,
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
        handleUpdateStatus,
        // Handlers & State Modal
        isEditModalOpen,
        selectedBatch,
        editLoading,
        handleOpenEditBatch,
        handleCloseEditBatch,
        handleSaveBatchNumber
    } = useBatchListTable(currentUser, reloadTrigger, onRefreshAll);

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
                fromPlanDate={fromPlanDate}
                toPlanDate={toPlanDate}
                fromActualDate={fromActualDate}
                toActualDate={toActualDate}
                fromCreatedDate={fromCreatedDate}
                toCreatedDate={toCreatedDate}
                fromDeliveryDate={fromDeliveryDate}
                toDeliveryDate={toDeliveryDate}
                currentUserRole={currentUser?.role}
                exporting={exporting}
                onSearchChange={handleSearchChange}
                onStatusChange={handleStatusChange}
                onFromPlanDateChange={setFromPlanDate}
                onToPlanDateChange={setToPlanDate}
                onFromActualDateChange={setFromActualDate}
                onToActualDateChange={setToActualDate}
                onFromCreatedDateChange={setFromCreatedDate}
                onToCreatedDateChange={setToCreatedDate}
                onFromDeliveryDateChange={setFromDeliveryDate}
                onToDeliveryDateChange={setToDeliveryDate}
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
                                {viewMode === 'BATCH' ? (
                                    <>
                                        <SortableHeader label="Batch Number" sortKey="batch_number" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} />
                                        <SortableHeader label="Product" sortKey="product_name" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} />
                                        <SortableHeader label={<>Prod. Dates<br /><small style={{ fontWeight: 'normal', color: '#6c757d' }}>(Plan / Actual)</small></>} sortKey="plan_production_date" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} align="center" />
                                        <SortableHeader label="Batch Status" sortKey="batch_status" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} align="center" />
                                        <SortableHeader label="PO Number" sortKey="po_number" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} />
                                    </>
                                ) : (
                                    <>
                                        <SortableHeader label="PO Number" sortKey="po_number" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} />
                                        <SortableHeader label={<>PO Created<br />Date</>} sortKey="po_created_date" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} align="center" />
                                        <SortableHeader label="Product" sortKey="product_name" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} />
                                        <SortableHeader label="Batch Number" sortKey="batch_number" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} />
                                    </>
                                )}
                                <SortableHeader label={<>Allocation Qty<br />(Pcs)</>} sortKey="allocated_qty" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} align="right" />
                                <SortableHeader label={<>Fulfilled Qty<br />(Pcs)</>} sortKey="fulfilled_qty" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} align="right" />
                                <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Percentage</th>
                                <SortableHeader label="Allocation Status" sortKey="status" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} align="center" />
                                <th style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {viewMode === 'BATCH' ? (
                                <BatchViewRows
                                    mappingList={mappingList}
                                    currentUserRole={currentUser?.role}
                                    poTolerance={poTolerance}
                                    onUpdateStatus={handleUpdateStatus}
                                    onOpenEditBatch={handleOpenEditBatch}
                                    loading={loading}
                                />
                            ) : (
                                <PoViewRows
                                    mappingList={mappingList}
                                    currentUserRole={currentUser?.role}
                                    poTolerance={poTolerance}
                                    onUpdateStatus={handleUpdateStatus}
                                    loading={loading}
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

            {/* Modal Edit Batch Number */}
            <EditBatchModal
                isOpen={isEditModalOpen}
                onClose={handleCloseEditBatch}
                batchData={selectedBatch}
                onSubmit={handleSaveBatchNumber}
                loading={editLoading}
            />
        </div>
    );
};

export default BatchListTable;
