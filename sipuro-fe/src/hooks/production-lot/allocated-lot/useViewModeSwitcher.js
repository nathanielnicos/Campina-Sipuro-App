import { useState } from 'react';

export const useViewModeSwitcher = () => {
    const [viewMode, setViewMode] = useState('BATCH');

    const handleViewModeChange = (newMode) => {
        if (newMode !== viewMode) {
            setViewMode(newMode);
        }
    };

    return {
        viewMode,
        handleViewModeChange
    };
};

export default useViewModeSwitcher;
