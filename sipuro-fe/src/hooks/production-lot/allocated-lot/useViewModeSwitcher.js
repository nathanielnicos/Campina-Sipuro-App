import { useState } from 'react';

export const useViewModeSwitcher = (currentUserRole, onModeChange) => {
    const [viewMode, setViewMode] = useState(currentUserRole === 'CUSTOMER' ? 'PO' : 'BATCH');

    const handleViewModeChange = (newMode) => {
        if (newMode !== viewMode) {
            setViewMode(newMode);
            if (onModeChange) {
                onModeChange(newMode);
            }
        }
    };

    return {
        viewMode,
        handleViewModeChange
    };
};

export default useViewModeSwitcher;
