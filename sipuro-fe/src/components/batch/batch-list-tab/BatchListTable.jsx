import PaginationControl from '../../common/PaginationControl';
import Filter from './Filter';
import ViewModeSwitcher from './ViewModeSwitcher';
import { BatchViewRows, PoViewRows } from './TableRow';

// Hook Custom
import { useBatchListTable } from '../../../hooks/batch/batch-list-tab/useBatchListTable';

const BatchListTable = ({ currentUser, onUpdateStatus, reloadTrigger }) => {
    const {
        mappingList,
        poTolerance,
        loading,
        error,
        searchQuery,
        fromDate,
        toDate,
        batchStatus,
        pagination,
        viewMode,
        exporting,
        setPage,
        setLimit,
        setViewMode,
        handleSearchChange,
        handleFromDateChange,
        handleToDateChange,
        handleStatusChange,
        handleResetFilters,
        handleExportExcel,
        getPoGroupedData
    } = useBatchListTable(currentUser, reloadTrigger);

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
                fromDate={fromDate}
                toDate={toDate}
                batchStatus={batchStatus}
                currentUserRole={currentUser?.role}
                exporting={exporting}
                onSearchChange={handleSearchChange}
                onFromDateChange={handleFromDateChange}
                onToDateChange={handleToDateChange}
                onStatusChange={handleStatusChange}
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
                                        {currentUser?.role !== 'CUSTOMER' && (
                                            <th style={{ padding: '12px 14px' }}>Batch Number</th>
                                        )}
                                        <th style={{ padding: '12px 14px' }}>Product</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Planned Production Date</th>
                                        {currentUser?.role !== 'CUSTOMER' && (
                                            <th style={{ padding: '12px 14px', textAlign: 'center' }}>Batch Status</th>
                                        )}
                                        <th style={{ padding: '12px 14px' }}>PO Number</th>
                                    </>
                                ) : (
                                    <>
                                        <th style={{ padding: '12px 14px' }}>PO Number</th>
                                        <th style={{ padding: '12px 14px' }}>Product</th>
                                        {currentUser?.role !== 'CUSTOMER' && (
                                            <th style={{ padding: '12px 14px' }}>Batch Number</th>
                                        )}
                                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Planned Production Date</th>
                                        {currentUser?.role !== 'CUSTOMER' && (
                                            <th style={{ padding: '12px 14px', textAlign: 'center' }}>Batch Status</th>
                                        )}
                                    </>
                                )}
                                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocation Qty (Pcs)</th>
                                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Fulfilled Qty (Pcs)</th>
                                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Percentage</th>
                                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Allocation Status</th>
                                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {viewMode === 'BATCH' ? (
                                <BatchViewRows
                                    mappingList={mappingList}
                                    currentUserRole={currentUser?.role}
                                    poTolerance={poTolerance}
                                    onUpdateStatus={onUpdateStatus}
                                />
                            ) : (
                                <PoViewRows
                                    poList={getPoGroupedData()}
                                    currentUserRole={currentUser?.role}
                                    poTolerance={poTolerance}
                                    onUpdateStatus={onUpdateStatus}
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
        </div>
    );
};

export default BatchListTable;
