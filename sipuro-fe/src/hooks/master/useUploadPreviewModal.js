import { useState, useMemo } from 'react';
import { useGlobalModal } from '../../context/ModalContext';

export const useUploadPreviewModal = ({ previewData, onConfirm }) => {
    const { showConfirm } = useGlobalModal();
    const [activeTab, setActiveTab] = useState('ALL');

    // Mencegah pembuatan acuan array/object baru setiap render agar tidak memicu warning ESLint pada useMemo
    const summary = useMemo(() => previewData?.summary || {}, [previewData?.summary]);
    const dataList = useMemo(() => previewData?.data || [], [previewData?.data]);

    const {
        total = 0,
        newCount = 0,
        updatedCount = 0,
        unchangedCount = 0,
        notFoundCount = 0
    } = summary;

    const hasChangesToSave = (newCount + updatedCount) > 0;

    // Filter data berdasarkan tab aktif
    const filteredData = useMemo(() => {
        return dataList.filter(item => {
            if (activeTab === 'NEW') return item.status === 'NEW';
            if (activeTab === 'UPDATED') return item.status === 'UPDATED';
            if (activeTab === 'UNCHANGED') return item.status === 'UNCHANGED';
            if (activeTab === 'NOT_FOUND') return item.status === 'NOT_FOUND';
            return true;
        });
    }, [dataList, activeTab]);

    // Handler konfirmasi simpan
    const handleSave = () => {
        showConfirm({
            title: 'Save Data Confirmation',
            message: 'Are you sure you want to save this data to the database?',
            confirmText: 'Save',
            onConfirm: () => {
                if (onConfirm) {
                    onConfirm(dataList);
                }
            }
        });
    };

    // Helper style badge status
    const getStatusBadgeProps = (status) => {
        const baseStyle = {
            display: 'block',
            width: '100%',
            padding: '4px 0',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            textAlign: 'center',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap',
            lineHeight: '1.2',
            color: '#fff'
        };

        switch (status) {
            case 'NEW':
                return { label: 'NEW', style: { ...baseStyle, backgroundColor: '#198754' } };
            case 'UPDATED':
                return { label: 'UPDATED', style: { ...baseStyle, backgroundColor: '#fd7e14' } };
            case 'NOT_FOUND':
                return { label: 'SKU NOT FOUND', style: { ...baseStyle, backgroundColor: '#dc3545' } };
            default:
                return { label: 'UNCHANGED', style: { ...baseStyle, backgroundColor: '#6c757d' } };
        }
    };

    // Helper style baris tabel
    const getRowStyle = (status) => {
        switch (status) {
            case 'NEW':
                return { backgroundColor: '#e8f5e9' };
            case 'UPDATED':
                return { backgroundColor: '#fff8e1' };
            case 'NOT_FOUND':
                return { backgroundColor: '#ffebee' };
            default:
                return {};
        }
    };

    return {
        activeTab,
        setActiveTab,
        summary: { total, newCount, updatedCount, unchangedCount, notFoundCount },
        filteredData,
        hasChangesToSave,
        handleSave,
        getStatusBadgeProps,
        getRowStyle
    };
};
