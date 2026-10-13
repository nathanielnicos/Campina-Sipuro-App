import FilterBar from './DOFilterBar';
import Table from './DOTable';

import { useDOFilterBar } from '../../../hooks/documentFlow/do/useDOFilterBar';
import { useDOTable } from '../../../hooks/documentFlow/do/useDOTable';

const DOTab = ({ reloadTrigger }) => {
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
    } = useDOFilterBar();

    const {
        doList,
        loading,
        fetching,
        error,
        pageSize,
        totalPages,
        totalItems,
        handlePageChange,
        handleLimitChange
    } = useDOTable({
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

            {loading && <p>Loading Delivery Orders data...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}

            {!loading && !error && (
                <Table
                    doList={doList}
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

export default DOTab;
