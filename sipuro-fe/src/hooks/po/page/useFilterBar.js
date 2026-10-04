import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const useFilterBar = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const initialSearch = searchParams.get('search') || '';

    const [search, setSearch] = useState(initialSearch);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const urlSearch = searchParams.get('search') || '';
        if (urlSearch !== search) {
            setSearch(urlSearch);
        }
    }, [searchParams, search]);

    const isFilterActive = Boolean(
        search || startDate || endDate || status
    );

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setCurrentPage(1);
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearch(value);
        setCurrentPage(1);

        if (value) {
            setSearchParams((prev) => {
                prev.set('search', value);
                return prev;
            });
        } else {
            setSearchParams((prev) => {
                prev.delete('search');
                return prev;
            });
        }
    };

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
        setCurrentPage(1);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
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
        setStatus('');
        setSortConfig({ key: 'created_at', direction: 'desc' });
        setCurrentPage(1);

        setSearchParams((prev) => {
            prev.delete('search');
            return prev;
        });
    };

    return {
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
    };
};
