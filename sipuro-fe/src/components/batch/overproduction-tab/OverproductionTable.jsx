import React from 'react';
import PaginationControl from '../../common/PaginationControl';
import SortableHeader from '../../common/SortableHeader';
import Filter from './Filter';
import TableRow from './TableRow';
import ReallocateModal from '../reallocate-modal/ReallocateModal';

// Hook Custom
import { useOverproductionTable } from '../../../hooks/batch/overproduction-tab/useOverproductionTable';

const OverproductionTable = ({ currentUser, reloadTrigger, onRefreshAll }) => {
    const {
        unallocatedList,
        loading,
        error,
        searchStock,
        fromProdDate,
        toProdDate,
        sortKey,
        sortOrder,
        pagination,
        selectedStock,
        openAllocations,
        targetAllocId,
        qtyToAllocate,
        loadingAlloc,
        submitting,
        setPage,
        setLimit,
        setTargetAllocId,
        setQtyToAllocate,
        handleStockSearchChange,
        handleFromProdDateChange,
        handleToProdDateChange,
        handleResetFilters,
        handleSort,
        handleOpenModal,
        handleCloseModal,
        handleSubmitReallocate
    } = useOverproductionTable(currentUser, reloadTrigger, onRefreshAll);

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
                searchStock={searchStock}
                fromProdDate={fromProdDate}
                toProdDate={toProdDate}
                onSearchChange={handleStockSearchChange}
                onFromProdDateChange={handleFromProdDateChange}
                onToProdDateChange={handleToProdDateChange}
                onResetFilters={handleResetFilters}
            />

            <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                <SortableHeader
                                    label="Source Batch Number"
                                    sortKey="batch_number"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                />
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
                                    label="Production Date"
                                    sortKey="production_date"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                    align="center"
                                />
                                <SortableHeader
                                    label="Qty (Pcs)"
                                    sortKey="qty_available"
                                    currentSortKey={sortKey}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                    align="right"
                                />
                                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <TableRow
                                unallocatedList={unallocatedList}
                                onOpenModal={handleOpenModal}
                            />
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

                <ReallocateModal
                    selectedStock={selectedStock}
                    openAllocations={openAllocations}
                    targetAllocId={targetAllocId}
                    qtyToAllocate={qtyToAllocate}
                    loadingAlloc={loadingAlloc}
                    submitting={submitting}
                    onTargetAllocIdChange={setTargetAllocId}
                    onQtyToAllocateChange={setQtyToAllocate}
                    onClose={handleCloseModal}
                    onSubmit={handleSubmitReallocate}
                />
            </div>
        </div>
    );
};

export default OverproductionTable;
