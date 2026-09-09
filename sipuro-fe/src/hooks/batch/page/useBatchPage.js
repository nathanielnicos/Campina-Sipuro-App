import { useState } from 'react';

export const useBatchPage = () => {
    const [reloadTrigger, setReloadTrigger] = useState(0);
    const [activeTab, setActiveTab] = useState('summary');

    const handleTriggerReload = () => {
        setReloadTrigger((prev) => prev + 1);
    };

    return {
        reloadTrigger,
        activeTab,
        setActiveTab,
        handleTriggerReload
    };
};
