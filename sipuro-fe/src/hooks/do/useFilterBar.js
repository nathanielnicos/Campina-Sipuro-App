import { useState } from 'react';

export const useFilterBar = () => {
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [completedStartDate, setCompletedStartDate] = useState('');
    const [completedEndDate, setCompletedEndDate] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'po_created_date', direction: 'DESC' });
    const [currentPage, setCurrentPage] = useState(1);

    const isFilterActive = Boolean(
        search || startDate || endDate || completedStartDate || completedEndDate
    );

    const handleSort = (key) => {
        let direction = 'ASC';
        if (sortConfig.key === key && sortConfig.direction === 'ASC') {
            direction = 'DESC';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleStartDateChange = (e) => {
        setStartDate(e?.target?.value || '');
        setCurrentPage(1);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e?.target?.value || '');
        setCurrentPage(1);
    };

    const handleCompletedStartDateChange = (e) => {
        setCompletedStartDate(e?.target?.value || '');
        setCurrentPage(1);
    };

    const handleCompletedEndDateChange = (e) => {
        setCompletedEndDate(e?.target?.value || '');
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        setSearch('');
        setStartDate('');
        setEndDate('');
        setCompletedStartDate('');
        setCompletedEndDate('');
        setCurrentPage(1);
    };

    return {
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
    };
};
