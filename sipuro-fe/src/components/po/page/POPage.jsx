import { useState } from 'react';
import FilterBar from './FilterBar';
import Table from './Table';
import POPdfModal from '../pdf-modal/PdfModal';

// Import Hooks
import { useFilterBar } from '../../../hooks/po/page/useFilterBar';
import { useTable } from '../../../hooks/po/page/useTable';
import { useExportExcel } from '../../../hooks/po/page/useExportExcel';

const POPage = ({ customerId = 1, onCreateNewPO, onSelectPODetail, user }) => {
    const [selectedPdfPoId, setSelectedPdfPoId] = useState(null);

    // 1. Hook Filter
    const {
        search,
        startDate,
        endDate,
        status,
        sortConfig,
        currentPage,
        setCurrentPage,
        isFilterActive,
        handleSort,
        handleSearchChange,
        handleStartDateChange,
        handleEndDateChange,
        handleStatusChange,
        handleResetFilters
    } = useFilterBar();

    // 2. Hook Fetch List Data (Kirimkan nilai eksplisit, tanpa dibungkus objek filters)
    const {
        poList,
        loading,
        fetching,
        error,
        pageSize,
        totalPages,
        totalItems,
        handlePageChange,
        handleLimitChange
    } = useTable({
        customerId,
        currentPage,
        setCurrentPage,
        search,
        startDate,
        endDate,
        status,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction
    });

    // 3. Hook Export Excel
    const { exporting, handleExportExcel } = useExportExcel({
        customerId,
        filters: { search, startDate, endDate, status }
    });

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <FilterBar
                search={search}
                startDate={startDate}
                endDate={endDate}
                status={status}
                isFilterActive={isFilterActive}
                userRole={user?.role}
                exporting={exporting}
                onSearchChange={handleSearchChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
                onStatusChange={handleStatusChange}
                onResetFilters={handleResetFilters}
                onExportExcel={handleExportExcel}
                onCreateNewPO={onCreateNewPO}
            />

            {loading && <p>Loading PO data...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && (
                <Table
                    poList={poList}
                    fetching={fetching}
                    sortConfig={sortConfig}
                    user={user}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onSort={handleSort}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                    onSelectPODetail={onSelectPODetail}
                    onOpenPdfModal={(poId) => setSelectedPdfPoId(poId)}
                />
            )}

            {selectedPdfPoId && (
                <POPdfModal
                    poId={selectedPdfPoId}
                    onClose={() => setSelectedPdfPoId(null)}
                />
            )}
        </div>
    );
};

export default POPage;
