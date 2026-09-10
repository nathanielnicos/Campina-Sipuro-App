import PaginationControl from '../../common/PaginationControl';
import BatchAllocationModal from '../batch-allocation-modal/BatchAllocationModal';
import Filter from './Filter';
import TableRow from './TableRow';

// Hooks
import { useUnbatchedTable } from '../../../hooks/batch/unbatched-tab/useUnbatchedTable';
import { useBatchAllocation } from '../../../hooks/batch/unbatched-tab/useBatchAllocation';

const UnbatchedTable = ({ currentUser, reloadTrigger, onRefreshAll }) => {
    const currentUserId = currentUser?.employee_id || currentUser?.id;

    // 1. Hook Tabel & Filter
    const {
        summaryList,
        loading,
        error,
        searchProduct,
        searchPo,
        fromCreatedDate,
        toCreatedDate,
        pagination,
        setPage,
        setLimit,
        loadData,
        handleProductChange,
        handlePoChange,
        handleFromDateChange,
        handleToDateChange,
        handleResetFilters
    } = useUnbatchedTable(reloadTrigger);

    // 2. Hook Alokasi Batch Modal
    const {
        selectedSku,
        isModalOpen,
        allocationMode,
        existingBatches,
        selectedBatchId,
        allocatedQty,
        batchCode,
        productionDate,
        submitting,
        setAllocatedQty,
        setAllocationMode,
        setBatchCode,
        setProductionDate,
        handleOpenModal,
        handleCloseModal,
        handleSelectBatchExisting,
        handleSubmitBatch
    } = useBatchAllocation({
        currentUserId,
        onSuccessAllocation: () => {
            loadData();
            if (onRefreshAll) onRefreshAll();
        }
    });

    const isPoFilterActive = Boolean(searchPo && searchPo.trim() !== '');

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
                searchProduct={searchProduct}
                searchPo={searchPo}
                fromCreatedDate={fromCreatedDate}
                toCreatedDate={toCreatedDate}
                onProductChange={handleProductChange}
                onPoChange={handlePoChange}
                onFromDateChange={handleFromDateChange}
                onToDateChange={handleToDateChange}
                onResetFilters={handleResetFilters}
            />

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>
                                <th style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>Product Code</th>
                                <th style={{ padding: '12px 10px' }}>Product Name</th>
                                <th style={{ padding: '12px 10px', textAlign: 'right', wordBreak: 'break-word' }}>Total Required Qty (Pcs)</th>
                                <th style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>PO Count</th>
                                <th style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>PO Number</th>
                                <th style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>Created Date</th>
                                <th style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>PO Qty (Pcs)</th>
                                <th style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap', width: '120px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryList.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                        No SKUs need to be allocated at this time.
                                    </td>
                                </tr>
                            ) : (
                                summaryList.map((row) => (
                                    <TableRow
                                        key={row.id_product}
                                        row={row}
                                        currentUserRole={currentUser?.role}
                                        isPoFilterActive={isPoFilterActive}
                                        onOpenModal={handleOpenModal}
                                    />
                                ))
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

            <BatchAllocationModal
                isOpen={isModalOpen}
                selectedSku={selectedSku}
                allocatedQty={allocatedQty}
                setAllocatedQty={setAllocatedQty}
                allocationMode={allocationMode}
                setAllocationMode={setAllocationMode}
                existingBatches={existingBatches}
                selectedBatchId={selectedBatchId}
                batchCode={batchCode}
                setBatchCode={setBatchCode}
                productionDate={productionDate}
                setProductionDate={setProductionDate}
                submitting={submitting}
                onSelectBatchExisting={handleSelectBatchExisting}
                onSubmit={handleSubmitBatch}
                onClose={handleCloseModal}
            />
        </div>
    );
};

export default UnbatchedTable;
