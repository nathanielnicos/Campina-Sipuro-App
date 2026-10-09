import { useState } from 'react';

export const useDocumentFlowPage = () => {
    const [reloadTrigger, setReloadTrigger] = useState(0);
    const [activeTab, setActiveTab] = useState('DELIVERY_ORDER');

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
