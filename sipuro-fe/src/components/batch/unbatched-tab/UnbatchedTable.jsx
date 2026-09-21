import React from 'react';
import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';
import BatchAllocationModal from '../batch-allocation-modal/BatchAllocationModal';
import Filter from './Filter';
import TableRow from './TableRow';

// Hooks
import { useUnbatchedTable } from '../../../hooks/batch/unbatched-tab/useUnbatchedTable';
import { useBatchAllocation } from '../../../hooks/batch/unbatched-tab/useBatchAllocation';

const UnbatchedTable = ({ currentUser, reloadTrigger, onRefreshAll }) => {
    const currentUserId = currentUser?.employee_id || currentUser?.id;

    const {
        summaryList,
        loading,
        error,
        searchProduct,
        searchPo,
        fromCreatedDate,
        toCreatedDate,
        fromDeliveryDate,
        toDeliveryDate,
        sortKey,
        sortOrder,
        pagination,
        setPage,
        setLimit,
        loadData,
        handleProductChange,
        handlePoChange,
        handleFromCreatedDateChange,
        handleToCreatedDateChange,
        handleFromDeliveryDateChange,
        handleToDeliveryDateChange,
        handleResetFilters,
        handleSort
    } = useUnbatchedTable(reloadTrigger);

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

    // Menutup akses tombol alokasi jika ada filter spesifik yang menyala (kecuali searchProduct)
    const isAnyFilterActive = Boolean(
        (searchPo && searchPo.trim() !== '') ||
        fromCreatedDate ||
        toCreatedDate ||
        fromDeliveryDate ||
        toDeliveryDate
    );

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
                fromDeliveryDate={fromDeliveryDate}
                toDeliveryDate={toDeliveryDate}
                onProductChange={handleProductChange}
                onPoChange={handlePoChange}
                onFromCreatedDateChange={handleFromCreatedDateChange}
                onToCreatedDateChange={handleToCreatedDateChange}
                onFromDeliveryDateChange={handleFromDeliveryDateChange}
                onToDeliveryDateChange={handleToDeliveryDateChange}
                onResetFilters={handleResetFilters}
            />

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                <SortableHeader
                                    label="Product Code"
                                    sortKey="product_code"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                />
                                <SortableHeader
                                    label="Product Name"
                                    sortKey="product_name"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                />
                                <SortableHeader
                                    label="Total Required Qty (Pcs)"
                                    sortKey="total_qty_needed"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                    align="right"
                                />
                                <SortableHeader
                                    label="PO Count"
                                    sortKey="total_po_count"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                    align="center"
                                />
                                <th style={{ padding: '12px 10px', textAlign: 'left', whiteSpace: 'nowrap', color: '#495057', fontWeight: '600' }}>PO Number</th>
                                <th style={{ padding: '12px 10px', textAlign: 'center', whiteSpace: 'nowrap', color: '#495057', fontWeight: '600' }}>PO Created Date</th>
                                <th style={{ padding: '12px 10px', textAlign: 'right', whiteSpace: 'nowrap', color: '#495057', fontWeight: '600' }}>PO Qty (Pcs)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryList.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#6c757d' }}>
                                        No SKUs need to be allocated at this time.
                                    </td>
                                </tr>
                            ) : (
                                summaryList.map((row) => (
                                    <TableRow
                                        key={row.id_product}
                                        row={row}
                                        currentUserRole={currentUser?.role}
                                        isAnyFilterActive={isAnyFilterActive}
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
