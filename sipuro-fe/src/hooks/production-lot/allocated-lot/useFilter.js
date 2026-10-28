import { useState } from 'react';
import { exportLotExcelApi } from '../../../services/productionLotApi';
import { useGlobalModal } from '../../../context/ModalContext';

export const useFilter = () => {
    const { showAlert } = useGlobalModal();

    const [searchQuery, setSearchQuery] = useState('');
    const [status, setStatus] = useState('');

    const [fromActualDate, setFromActualDate] = useState('');
    const [toActualDate, setToActualDate] = useState('');
    const [fromCreatedDate, setFromCreatedDate] = useState('');
    const [toCreatedDate, setToCreatedDate] = useState('');

    const [exporting, setExporting] = useState(false);

    const handleSearchChange = (e, resetPage) => {
        setSearchQuery(e.target.value);
        if (resetPage) resetPage(1);
    };

    const handleStatusChange = (e, resetPage) => {
        setStatus(e.target.value);
        if (resetPage) resetPage(1);
    };

    const handleDateChange = (setter, val, resetPage) => {
        setter(val);
        if (resetPage) resetPage(1);
    };

    const handleResetFilters = (resetPage) => {
        setSearchQuery('');
        setStatus('');
        setFromActualDate('');
        setToActualDate('');
        setFromCreatedDate('');
        setToCreatedDate('');
        if (resetPage) resetPage(1);
    };

    const handleExportExcel = async () => {
        setExporting(true);
        const res = await exportLotExcelApi({
            search: searchQuery,
            status,
            fromActualDate, toActualDate,
            fromCreatedDate, toCreatedDate,
        });
        setExporting(false);

        if (!res?.success) {
            showAlert({
                type: 'error',
                title: 'Export Failed',
                message: res?.message || 'Failed to export Excel file.'
            });
        }
    };

    return {
        searchQuery,
        status,
        fromActualDate, setFromActualDate,
        toActualDate, setToActualDate,
        fromCreatedDate, setFromCreatedDate,
        toCreatedDate, setToCreatedDate,
        exporting,
        handleSearchChange,
        handleStatusChange,
        handleDateChange,
        handleResetFilters,
        handleExportExcel
    };
};

export default useFilter;
