import { useState } from 'react';
import { exportPoExcelApi } from '../../../services/poApi';

export const useExportExcel = ({ customerId, filters }) => {
    const [exporting, setExporting] = useState(false);

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            await exportPoExcelApi(customerId, filters);
        } catch (err) {
            console.error('Error exporting PO:', err);
        } finally {
            setExporting(false);
        }
    };

    return {
        exporting,
        handleExportExcel
    };
};
