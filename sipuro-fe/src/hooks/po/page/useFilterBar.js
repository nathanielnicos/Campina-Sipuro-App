import { useState } from 'react';

export const useFilterBar = () => {
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [deliveryStartDate, setDeliveryStartDate] = useState('');
    const [deliveryEndDate, setDeliveryEndDate] = useState('');
    const [status, setStatus] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);

    const isFilterActive = Boolean(
        search || startDate || endDate || deliveryStartDate || deliveryEndDate || status
    );

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setCurrentPage(1);
    };

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
        setCurrentPage(1);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
        setCurrentPage(1);
    };

    const handleDeliveryStartDateChange = (e) => {
        setDeliveryStartDate(e.target.value);
        setCurrentPage(1);
    };

    const handleDeliveryEndDateChange = (e) => {
        setDeliveryEndDate(e.target.value);
        setCurrentPage(1);
    };

    const handleStatusChange = (e) => {
        setStatus(e.target.value);
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        if (!isFilterActive) return;
        setSearch('');
        setStartDate('');
        setEndDate('');
        setDeliveryStartDate('');
        setDeliveryEndDate('');
        setStatus('');
        setSortConfig({ key: 'created_at', direction: 'desc' });
        setCurrentPage(1);
    };

    return {
        search,
        startDate,
        endDate,
        deliveryStartDate,
        deliveryEndDate,
        status,
        sortConfig,
        currentPage,
        setCurrentPage,
        isFilterActive,
        handleSort,
        handleSearchChange,
        handleStartDateChange,
        handleEndDateChange,
        handleDeliveryStartDateChange,
        handleDeliveryEndDateChange,
        handleStatusChange,
        handleResetFilters
    };
};
