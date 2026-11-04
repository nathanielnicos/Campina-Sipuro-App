import { useState, useRef } from 'react';
import { exportDeliveryOrderExcelApi } from '../../../services/doApi';
import { useGlobalModal } from '../../../context/ModalContext';

/**
 * Unduh Excel DO dengan filter yang sedang aktif (pencarian dan rentang tanggal).
 * Berlaku untuk semua tampilan: file selalu berisi pengiriman, retur, dan saldo lot.
 */
export const useDeliveryOrderExport = ({ searchQuery, fromDoDate, toDoDate }) => {
    const { showAlert } = useGlobalModal();
    const [exporting, setExporting] = useState(false);
    // Guard sinkron terhadap klik ganda (state bisa terlambat diperbarui)
    const exportingRef = useRef(false);

    const handleExportExcel = async () => {
        if (exportingRef.current) return;
        exportingRef.current = true;
        setExporting(true);

        const res = await exportDeliveryOrderExcelApi({ search: searchQuery, fromDoDate, toDoDate });

        exportingRef.current = false;
        setExporting(false);

        if (!res?.success) {
            showAlert({
                type: 'error',
                title: 'Export Failed',
                message: res?.message || 'Failed to export Excel file.'
            });
        }
    };

    return { exporting, handleExportExcel };
};

export default useDeliveryOrderExport;
