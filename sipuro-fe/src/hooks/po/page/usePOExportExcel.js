import { useState } from 'react';
import { exportPoExcelApi } from '../../../services/poApi';
import { useGlobalModal } from '../../../context/ModalContext';

export const usePOExportExcel = ({ customerId, filters }) => {
    const [exporting, setExporting] = useState(false);
    const { showAlert } = useGlobalModal();

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const result = await exportPoExcelApi(customerId, filters);
            if (result && result.success === false) {
                showAlert({
                    type: 'error',
                    title: 'Export Failed',
                    message: result.message || 'Failed to export PO data to Excel.'
                });
            }
        } catch (err) {
            console.error('Error exporting PO:', err);
            showAlert({
                type: 'error',
                title: 'Export Failed',
                message: 'A connection error occurred while exporting PO data.'
            });
        } finally {
            setExporting(false);
        }
    };

    return {
        exporting,
        handleExportExcel
    };
};
