import { useState } from 'react';

export const useViewModeSwitcher = () => {
    const [viewMode, setViewMode] = useState('BATCH');
    // Tingkat detail untuk By PO dan By Batch: 'SUMMARY' (tanpa lot, bawaan) atau 'LOT' (rincian per lot)
    const [detailLevel, setDetailLevel] = useState('SUMMARY');

    const handleViewModeChange = (newMode) => {
        if (newMode !== viewMode) {
            setViewMode(newMode);
        }
    };

    const handleDetailLevelChange = (newLevel) => {
        if (newLevel !== detailLevel) {
            setDetailLevel(newLevel);
        }
    };

    return {
        viewMode,
        detailLevel,
        handleViewModeChange,
        handleDetailLevelChange
    };
};

export default useViewModeSwitcher;
