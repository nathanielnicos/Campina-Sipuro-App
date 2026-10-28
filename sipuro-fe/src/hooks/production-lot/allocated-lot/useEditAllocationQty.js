import { useState } from 'react';
import { updateLotAllocationQtyApi } from '../../../services/productionLotApi';
import { useGlobalModal } from '../../../context/ModalContext';
import { formatQty } from '../../../utils/formatters';

export const useEditAllocationQty = (onRefresh) => {
    const { showConfirm, showAlert } = useGlobalModal();

    const [isOpen, setIsOpen] = useState(false);
    const [selectedAllocation, setSelectedAllocation] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleOpen = (allocation) => {
        setSelectedAllocation(allocation);
        setIsOpen(true);
    };

    const handleClose = () => {
        setSelectedAllocation(null);
        setIsOpen(false);
    };

    const executeSave = async (allocationId, newAllocatedQty, reason) => {
        setLoading(true);
        try {
            const res = await updateLotAllocationQtyApi(allocationId, { newAllocatedQty, reason });
            if (res && res.success) {
                showAlert({
                    type: 'success',
                    title: 'Success',
                    message: res.message || 'Allocated quantity updated successfully.'
                });
                handleClose();
                if (onRefresh) onRefresh();
            } else {
                showAlert({
                    type: 'error',
                    title: 'Failed',
                    message: res?.message || 'Failed to update allocated quantity.'
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = (allocationId, newAllocatedQty, reason) => {
        showConfirm({
            title: 'Update Allocated Quantity',
            message: `Are you sure you want to update allocated quantity to ${formatQty(newAllocatedQty)}?`,
            confirmText: 'Save Changes',
            onConfirm: () => executeSave(allocationId, newAllocatedQty, reason)
        });
    };

    return {
        isOpen,
        selectedAllocation,
        loading,
        handleOpen,
        handleClose,
        handleSave
    };
};

export default useEditAllocationQty;
