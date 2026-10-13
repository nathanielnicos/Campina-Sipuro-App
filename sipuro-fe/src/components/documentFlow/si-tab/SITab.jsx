import FilterBar from './SIFilterBar';
import Table from './SITable';

import { useSIFilterBar } from '../../../hooks/documentFlow/si/useSIFilterBar';
import { useSITable } from '../../../hooks/documentFlow/si/useSITable';

const SITab = ({ reloadTrigger }) => {
    const {
        search,
        startDate,
        endDate,
        pickUpStartDate,
        pickUpEndDate,
        sortConfig,
        currentPage,
        setCurrentPage,
        isFilterActive,
        handleSort,
        handleSearchChange,
        handleStartDateChange,
        handleEndDateChange,
        handlePickUpStartDateChange,
        handlePickUpEndDateChange,
        handleResetFilters
    } = useSIFilterBar();

    const {
        siList,
        loading,
        fetching,
        error,
        pageSize,
        totalPages,
        totalItems,
        handlePageChange,
        handleLimitChange
    } = useSITable({
        currentPage,
        setCurrentPage,
        search,
        startDate,
        endDate,
        pickUpStartDate,
        pickUpEndDate,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
        reloadTrigger
    });

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <FilterBar
                search={search}
                startDate={startDate}
                endDate={endDate}
                pickUpStartDate={pickUpStartDate}
                pickUpEndDate={pickUpEndDate}
                isFilterActive={isFilterActive}
                onSearchChange={handleSearchChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
                onPickUpStartDateChange={handlePickUpStartDateChange}
                onPickUpEndDateChange={handlePickUpEndDateChange}
                onResetFilters={handleResetFilters}
            />

            {loading && <p>Loading Sales Invoices data...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && (
                <Table
                    siList={siList}
                    fetching={fetching}
                    sortConfig={sortConfig}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onSort={handleSort}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                />
            )}
        </div>
    );
};

export default SITab;
