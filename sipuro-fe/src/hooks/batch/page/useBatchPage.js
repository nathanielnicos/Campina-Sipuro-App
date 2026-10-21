import { useState } from 'react';

export const useBatchPage = () => {
    const [reloadTrigger, setReloadTrigger] = useState(0);

    const handleTriggerReload = () => {
        setReloadTrigger((prev) => prev + 1);
    };

    return {
        reloadTrigger,
        handleTriggerReload
    };
};
