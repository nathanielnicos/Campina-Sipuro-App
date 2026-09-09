import { useState } from 'react';
import { updateAllocationStatusApi } from '../../../services/batchApi';

export const useBatchPage = () => {
    const [reloadTrigger, setReloadTrigger] = useState(0);
    const [activeTab, setActiveTab] = useState('summary');
    const [loading, setLoading] = useState(false);

    const handleTriggerReload = () => {
        setReloadTrigger((prev) => prev + 1);
    };

    const handleUpdateStatus = async (allocationId, action) => {
        const actionText = action === 'CANCEL' ? 'cancel' : 'force close';

        const reason = window.prompt(`Are you sure you want to ${actionText} this batch allocation?\nEnter reason (optional):`);

        if (reason === null) return;

        setLoading(true);
        try {
            const res = await updateAllocationStatusApi(allocationId, { action, reason });
            if (res && res.success) {
                alert(res.message || 'Allocation status updated successfully.');
                handleTriggerReload();
            } else {
                alert('Failed: ' + (res?.message || 'Failed to update allocation status.'));
            }
        } catch (err) {
            alert('A system error occurred while updating the status.');
        } finally {
            setLoading(false);
        }
    };

    return {
        reloadTrigger,
        activeTab,
        loading,
        setActiveTab,
        handleTriggerReload,
        handleUpdateStatus
    };
};
