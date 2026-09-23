import FilterBar from './FilterBar';
import Table from './Table';

// Import Hooks
import { useFilterBar } from '../../hooks/do/useFilterBar';
import { useTable } from '../../hooks/do/useTable';

const DOPage = () => {
    // 1. Hook Filter
    const {
        search,
        startDate,
        endDate,
        completedStartDate,
        completedEndDate,
        sortConfig,
        currentPage,
        setCurrentPage,
        isFilterActive,
        handleSort,
        handleSearchChange,
        handleStartDateChange,
        handleEndDateChange,
        handleCompletedStartDateChange,
        handleCompletedEndDateChange,
        handleResetFilters
    } = useFilterBar();

    // 2. Hook Table Data
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
    } = useTable({
        currentPage,
        setCurrentPage,
        search,
        startDate,
        endDate,
        completedStartDate,
        completedEndDate,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction
    });

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <FilterBar
                search={search}
                startDate={startDate}
                endDate={endDate}
                completedStartDate={completedStartDate}
                completedEndDate={completedEndDate}
                isFilterActive={isFilterActive}
                onSearchChange={handleSearchChange}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
                onCompletedStartDateChange={handleCompletedStartDateChange}
                onCompletedEndDateChange={handleCompletedEndDateChange}
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

export default DOPage;
