// hooks/si/useFilterBar.js
import { useState } from 'react';

export const useFilterBar = () => {
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [pickUpStartDate, setPickUpStartDate] = useState('');
    const [pickUpEndDate, setPickUpEndDate] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'si_date', direction: 'DESC' });
    const [currentPage, setCurrentPage] = useState(1);

    const isFilterActive = Boolean(
        search || startDate || endDate || pickUpStartDate || pickUpEndDate
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

    const handlePickUpStartDateChange = (e) => {
        setPickUpStartDate(e?.target?.value || '');
        setCurrentPage(1);
    };

    const handlePickUpEndDateChange = (e) => {
        setPickUpEndDate(e?.target?.value || '');
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        setSearch('');
        setStartDate('');
        setEndDate('');
        setPickUpStartDate('');
        setPickUpEndDate('');
        setCurrentPage(1);
    };

    return {
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
    };
};
