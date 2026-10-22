import { useState } from 'react';

export const useDoPage = () => {
    const [reloadTrigger, setReloadTrigger] = useState(0);
    
    const handleTriggerReload = () => {
        setReloadTrigger((prev) => prev + 1);
    };

    return {
        reloadTrigger,
        handleTriggerReload
    };
};
