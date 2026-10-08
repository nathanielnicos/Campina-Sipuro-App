import React, { useState } from 'react';
import FilterBar from './FilterBar';
import Table from './Table';
import ImportModal from './ImportModal';

import { useFilterBar } from '../../hooks/documentFlow/do/useFilterBar';
import { useTable } from '../../hooks/documentFlow/do/useTable';

const DOPage = () => {
    const [isImportOpen, setIsImportOpen] = useState(false);

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

    const {
        doList,
        loading,
        fetching,
        error,
        pageSize,
        totalPages,
        totalItems,
        handlePageChange,
        handleLimitChange,
        refreshData
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h2>Delivery Orders Management</h2>
                <button
                    onClick={() => setIsImportOpen(true)}
                    style={{ backgroundColor: '#0d6efd', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    + Import Document Flow
                </button>
            </div>

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

            <ImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                onSuccess={refreshData}
            />
        </div>
    );
};

export default DOPage;
