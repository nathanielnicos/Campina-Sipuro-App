import { useState } from 'react';

export const useProductionLotPage = () => {
    const [reloadTrigger, setReloadTrigger] = useState(0);
    
    const handleTriggerReload = () => {
        setReloadTrigger((prev) => prev + 1);
    };

    return {
        reloadTrigger,
        handleTriggerReload
    };
};
